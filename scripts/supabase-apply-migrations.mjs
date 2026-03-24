import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

function fail(message) {
  console.error(`\n[Supabase migration] ${message}\n`);
  process.exit(1);
}

function getProjectRefFromEnvLocal() {
  const envPath = '.env.local';
  if (!existsSync(envPath)) {
    fail('Missing .env.local. Copy .env.example to .env.local first.');
  }

  const content = readFileSync(envPath, 'utf8');
  const urlLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('VITE_SUPABASE_URL='));

  if (!urlLine) {
    fail('VITE_SUPABASE_URL is missing in .env.local.');
  }

  const value = urlLine.slice('VITE_SUPABASE_URL='.length).trim();
  const cleanUrl = value.replace(/^['"]|['"]$/g, '');

  let hostname;
  try {
    hostname = new URL(cleanUrl).hostname;
  } catch {
    fail('VITE_SUPABASE_URL in .env.local is not a valid URL.');
  }

  const projectRef = hostname.split('.')[0];
  if (!projectRef) {
    fail('Could not derive project ref from VITE_SUPABASE_URL.');
  }

  return projectRef;
}

/**
 * Run Supabase CLI via npx. On Windows, spawnSync('npx', …, { shell: false }) often throws EINVAL;
 * execSync with a single shell line avoids that and passes global flags (e.g. --yes) reliably.
 */
function runSupabaseArgs(args) {
  const escapeArg = (a) => {
    if (/^[a-zA-Z0-9/_:.=@-]+$/.test(a)) return a;
    return `"${String(a).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  };
  const line = ['npx', '--yes', 'supabase', ...args].map(escapeArg).join(' ');
  try {
    execSync(line, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
  } catch (err) {
    const code = err?.status ?? 1;
    process.exit(code);
  }
}

const projectRef = getProjectRefFromEnvLocal();

console.log(`\n[Supabase migration] Linking project: ${projectRef}`);
runSupabaseArgs(['link', '--project-ref', projectRef]);

console.log('\n[Supabase migration] Applying migrations with db push');
// Global --yes must come before the subcommand or prompts still block non-TTY runs.
runSupabaseArgs(['--yes', 'db', 'push']);

console.log('\n[Supabase migration] Done.');
