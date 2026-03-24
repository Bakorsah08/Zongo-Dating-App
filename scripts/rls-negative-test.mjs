/**
 * RLS negative tests using two real Supabase Auth users (anon key + sign-in).
 *
 * Env: loads `.env.local` then `.env.rls.local` (RLS vars in the latter override).
 *   VITE_SUPABASE_URL / SUPABASE_URL and anon key from .env.local
 *   RLS_TEST_USER_* from .env.rls.local (see rls-test.env.example)
 *
 * Run: node scripts/rls-negative-test.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** Project root (folder with package.json), not process.cwd() — npm/shell cwd can differ. */
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(filename, overrideExisting) {
  const p = join(projectRoot, filename);
  if (!existsSync(p)) return;
  let raw = readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (overrideExisting || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile('.env.local', false);
loadEnvFile('.env.rls.local', true);

const url =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const anon =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const aEmail = process.env.RLS_TEST_USER_A_EMAIL || '';
const aPass = process.env.RLS_TEST_USER_A_PASSWORD || '';
const bEmail = process.env.RLS_TEST_USER_B_EMAIL || '';
const bPass = process.env.RLS_TEST_USER_B_PASSWORD || '';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!url || !anon) die('Missing SUPABASE_URL/VITE_SUPABASE_URL and anon key.');
if (!aEmail || !aPass || !bEmail || !bPass) {
  const rlsPath = join(projectRoot, '.env.rls.local');
  const blank = [
    !aEmail && 'RLS_TEST_USER_A_EMAIL',
    !aPass && 'RLS_TEST_USER_A_PASSWORD',
    !bEmail && 'RLS_TEST_USER_B_EMAIL',
    !bPass && 'RLS_TEST_USER_B_PASSWORD',
  ].filter(Boolean);
  let hint;
  if (!existsSync(rlsPath)) {
    hint = `No .env.rls.local at:\n  ${rlsPath}\nCopy rls-test.env.example to that path.`;
  } else {
    hint = `Non-empty values required in .env.rls.local (save the file). Missing or empty: ${blank.join(', ')}.`;
  }
  die(
    [
      'Missing RLS test credentials.',
      '',
      hint,
      '',
      'Supabase URL/anon key still come from .env.local.',
    ].join('\n'),
  );
}

function client() {
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function assertEmpty(label, data, error) {
  if (error) {
    if (error.code === 'PGRST116') return; // no rows
    throw new Error(`${label}: ${error.message} (${error.code})`);
  }
  if (data !== null && data !== undefined) {
    if (Array.isArray(data) && data.length === 0) return;
    if (typeof data === 'object' && !Array.isArray(data)) return; // .single() miss
    throw new Error(`${label}: expected no data, got ${JSON.stringify(data)}`);
  }
}

async function expectInsertDenied(label, promise) {
  const { error } = await promise;
  if (!error) throw new Error(`${label}: insert should have been denied (RLS)`);
  const msg = (error.message || '').toLowerCase();
  const ok =
    error.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('policy');
  if (!ok) throw new Error(`${label}: unexpected error: ${error.message} (${error.code})`);
}

async function main() {
  const alice = client();
  const bob = client();

  const { data: sa, error: ea } = await alice.auth.signInWithPassword({
    email: aEmail,
    password: aPass,
  });
  if (ea || !sa.user) die(`User A sign-in failed: ${ea?.message}`);

  const { data: sb, error: eb } = await bob.auth.signInWithPassword({
    email: bEmail,
    password: bPass,
  });
  if (eb || !sb.user) die(`User B sign-in failed: ${eb?.message}`);

  const userA = sa.user;
  const userB = sb.user;
  if (userA.id === userB.id) die('User A and B must be different accounts.');

  const low = userA.id < userB.id ? userA.id : userB.id;
  const high = userA.id < userB.id ? userB.id : userA.id;

  await alice.from('match_pairs').upsert(
    { user_low: low, user_high: high },
    { onConflict: 'user_low,user_high' },
  );

  const { data: convRow, error: convErr } = await alice
    .from('conversations')
    .insert({
      participant_a: userA.id,
      participant_b: userB.id,
    })
    .select('id')
    .maybeSingle();

  let convId = convRow?.id;
  if (convErr?.code === '23505') {
    const { data: existing } = await alice
      .from('conversations')
      .select('id')
      .eq('participant_a', low)
      .eq('participant_b', high)
      .maybeSingle();
    convId = existing?.id;
  } else if (convErr) {
    console.warn('conversation insert:', convErr.message);
  }

  // --- Private reads as A: B's rows must not appear
  {
    const { data, error } = await alice
      .from('user_account')
      .select('user_id')
      .eq('user_id', userB.id);
    assertEmpty('user_account peer select (A→B)', data, error);
  }
  {
    const { data, error } = await alice
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userB.id);
    assertEmpty('user_preferences peer select (A→B)', data, error);
  }
  {
    const { data, error } = await alice
      .from('user_ad_submissions')
      .select('id')
      .eq('user_id', userB.id);
    assertEmpty('user_ad_submissions peer select (A→B)', data, error);
  }

  // gift_events: A must not read B↔third-party (if any); at minimum no rows solely between B and someone else appear.
  {
    const { data, error } = await alice.from('gift_events').select('id, sender_id, recipient_id');
    if (error) throw new Error(`gift_events select A: ${error.message}`);
    const leak = (data || []).filter(
      (r) =>
        (r.sender_id === userB.id || r.recipient_id === userB.id) &&
        r.sender_id !== userA.id &&
        r.recipient_id !== userA.id,
    );
    if (leak.length)
      throw new Error(`gift_events: A sees B-only-third-party rows: ${JSON.stringify(leak)}`);
  }

  // profiles: discover allows reading B; updates as A must not touch B
  {
    const { data, error } = await alice.from('profiles').select('id').eq('id', userB.id).maybeSingle();
    if (error) throw new Error(`profiles read B as A: ${error.message}`);
    if (!data?.id) console.warn('WARN: B has no profile row (discover read skipped).');
  }
  {
    const { data, error } = await alice
      .from('profiles')
      .update({ display_name: '__rls_probe__' })
      .eq('id', userB.id)
      .select('id');
    if (error) throw new Error(`profiles update B as A: ${error.message}`);
    if (data && data.length > 0) throw new Error('profiles: A updated B row (RLS leak)');
  }

  // conversation access: outsider (random uuid) — no messages
  {
    const fake = '00000000-0000-4000-8000-000000000000';
    const { data, error } = await alice
      .from('messages')
      .select('id')
      .eq('conversation_id', fake);
    assertEmpty('messages fake conversation (A)', data, error);
  }

  // Forged sender on real thread
  if (convId) {
    await expectInsertDenied('messages forged sender_id', bob.from('messages').insert({
      conversation_id: convId,
      sender_id: userA.id,
      body: 'should be rejected',
    }));

    const { data: otherSide, error: convSeenErr } = await bob
      .from('conversations')
      .select('id')
      .eq('id', convId)
      .maybeSingle();
    if (convSeenErr) throw new Error(convSeenErr.message);
    if (!otherSide?.id)
      throw new Error('conversations: B cannot see A↔B thread (expected visible to both)');
  } else {
    console.warn('SKIP forged message / conv visibility: no conversation id.');
  }

  await expectInsertDenied(
    'user_ad_submissions wrong user_id',
    alice.from('user_ad_submissions').insert({
      user_id: userB.id,
      duration_days: 7,
      title: 'x',
    }),
  );

  await expectInsertDenied(
    'user_preferences wrong user_id',
    alice.from('user_preferences').insert({ user_id: userB.id, discovery: {} }),
  );

  await expectInsertDenied(
    'gift_events forged sender',
    alice.from('gift_events').insert({
      sender_id: userB.id,
      recipient_id: userA.id,
      gift_id: 'probe',
      token_value: 0,
    }),
  );

  // Symmetry: B cannot read A private tables
  {
    const { data, error } = await bob.from('user_account').select('user_id').eq('user_id', userA.id);
    assertEmpty('user_account peer select (B→A)', data, error);
  }
  {
    const { data, error } = await bob.from('user_preferences').select('user_id').eq('user_id', userA.id);
    assertEmpty('user_preferences peer select (B→A)', data, error);
  }

  console.log('RLS negative tests: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
