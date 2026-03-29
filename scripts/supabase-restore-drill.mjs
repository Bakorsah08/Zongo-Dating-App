import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

function fail(message) {
  console.error(`\n[Supabase restore drill] ${message}\n`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    fail(`Missing ${filePath}. Copy .env.backup.example to ${filePath} first.`);
  }

  const raw = readFileSync(filePath, 'utf8');

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function escapeArg(value) {
  if (/^[a-zA-Z0-9/_:.,=@-]+$/.test(value)) return value;
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function runSupabase(args) {
  const command = ['npx', '--yes', 'supabase', ...args].map(escapeArg).join(' ');
  execSync(command, { stdio: 'inherit', shell: true, windowsHide: true });
}

function latestBackupDir(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return entries.length ? entries[entries.length - 1] : null;
}

const env = parseEnvFile('.env.backup.local');
const restoreTarget = env.SUPABASE_RESTORE_DB_URL || process.env.SUPABASE_RESTORE_DB_URL;
if (!restoreTarget) {
  fail('SUPABASE_RESTORE_DB_URL is required for restore drills.');
}

const confirm = (env.SUPABASE_RESTORE_CONFIRM || '').toLowerCase();
if (confirm !== 'yes') {
  fail('Set SUPABASE_RESTORE_CONFIRM=yes in .env.backup.local to run a restore drill.');
}

const backupRoot = path.resolve(env.SUPABASE_BACKUP_DIR || 'backups/supabase');
if (!existsSync(backupRoot)) {
  fail(`Backup directory not found: ${backupRoot}`);
}

const backupSetName = env.SUPABASE_RESTORE_BACKUP_SET || latestBackupDir(backupRoot);
if (!backupSetName) {
  fail('No backup set found. Run npm run supabase:backup first.');
}

const backupSet = path.join(backupRoot, backupSetName);
const schemaFile = path.join(backupSet, 'schema.sql');
const dataFile = path.join(backupSet, 'data.sql');

if (!existsSync(schemaFile) || !existsSync(dataFile)) {
  fail(`Missing schema/data files in ${backupSet}.`);
}

console.log(`\n[Supabase restore drill] Backup set: ${backupSetName}`);
console.log('[Supabase restore drill] Running test query against target DB');
runSupabase(['db', 'query', '--db-url', restoreTarget, '--output', 'table', 'select now() as restore_target_time;']);

console.log('[Supabase restore drill] Applying schema.sql');
runSupabase(['db', 'query', '--db-url', restoreTarget, '--file', schemaFile]);

console.log('[Supabase restore drill] Applying data.sql');
runSupabase(['db', 'query', '--db-url', restoreTarget, '--file', dataFile]);

console.log('[Supabase restore drill] Validating with lightweight checks');
runSupabase([
  'db',
  'query',
  '--db-url',
  restoreTarget,
  '--output',
  'table',
  "select count(*) as table_count from information_schema.tables where table_schema='public';",
]);

console.log('\n[Supabase restore drill] Completed successfully.\n');
