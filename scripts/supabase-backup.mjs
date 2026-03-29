import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';

function redactSecrets(text) {
  return String(text).replace(
    /postgres(ql)?:\/\/([^:\s]+):([^@\s]+)@/gi,
    (_m, ql, user) => `postgres${ql ? 'ql' : ''}://${user}:***@`,
  );
}

function fail(message) {
  console.error(`\n[Supabase backup] ${message}\n`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    fail(`Missing ${filePath}. Copy .env.backup.example to ${filePath} first.`);
  }
  const raw = readFile(filePath);
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

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    fail(`Unable to read ${filePath}.`);
  }
}

function escapeArg(value) {
  if (/^[a-zA-Z0-9/_:.,=@-]+$/.test(value)) return value;
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function runSupabase(args) {
  const command = ['npx', '--yes', 'supabase', ...args].map(escapeArg).join(' ');
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8', shell: true, windowsHide: true });
    if (output) process.stdout.write(output);
  } catch (error) {
    const stdout = String(error?.stdout ?? '');
    const stderr = String(error?.stderr ?? '');
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    const combinedOutput = `${error?.message ?? ''}\n${stdout}\n${stderr}`;
    const wrapped = new Error('Supabase db dump failed');
    wrapped.combinedOutput = combinedOutput;
    throw wrapped;
  }
}

function runShell(command) {
  try {
    execSync(command, { stdio: 'inherit', shell: true, windowsHide: true });
  } catch (error) {
    const combinedOutput = `${error?.message ?? ''}\n${error?.stdout ?? ''}\n${error?.stderr ?? ''}`;
    if (combinedOutput.includes('could not translate host name')) {
      fail(
        `Database host could not be resolved. Confirm SUPABASE_DB_URL uses the exact Postgres connection string from Supabase Dashboard -> Project Settings -> Database. ${redactSecrets(combinedOutput)}`,
      );
    }
    fail(`Native dump command failed. ${redactSecrets(combinedOutput)}`);
  }
}

function commandWorks(command) {
  try {
    execSync(command, { stdio: 'pipe', shell: true, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function parseVersion(name) {
  const m = String(name).match(/^(\d+)(?:\.(\d+))?/);
  if (!m) return [0, 0];
  return [Number.parseInt(m[1] ?? '0', 10), Number.parseInt(m[2] ?? '0', 10)];
}

function compareVersionDesc(a, b) {
  if (a[0] !== b[0]) return b[0] - a[0];
  return b[1] - a[1];
}

function resolvePgTools(env) {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const fromOverride = env.SUPABASE_PG_BIN_DIR || process.env.SUPABASE_PG_BIN_DIR;
  if (fromOverride) {
    const dump = path.join(fromOverride, `pg_dump${exe}`);
    const dumpAll = path.join(fromOverride, `pg_dumpall${exe}`);
    if (existsSync(dump) && existsSync(dumpAll)) {
      return { pgDump: dump, pgDumpAll: dumpAll, source: 'SUPABASE_PG_BIN_DIR' };
    }
  }

  if (process.platform === 'win32') {
    const candidateRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
      .filter(Boolean)
      .map((p) => path.join(p, 'PostgreSQL'));
    for (const root of candidateRoots) {
      if (!existsSync(root)) continue;
      const versionDirs = readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => ({ name: d.name, parsed: parseVersion(d.name) }))
        .sort((a, b) => compareVersionDesc(a.parsed, b.parsed));
      for (const dir of versionDirs) {
        const bin = path.join(root, dir.name, 'bin');
        const dump = path.join(bin, `pg_dump${exe}`);
        const dumpAll = path.join(bin, `pg_dumpall${exe}`);
        if (existsSync(dump) && existsSync(dumpAll)) {
          return { pgDump: dump, pgDumpAll: dumpAll, source: bin };
        }
      }
    }
  }

  return { pgDump: `pg_dump${exe}`, pgDumpAll: `pg_dumpall${exe}`, source: 'PATH' };
}

function maybeFallbackToNativePgDump(kind, dbUrl, schemaArg, outputFile, primaryError, pgTools) {
  const combined = String(primaryError?.combinedOutput ?? `${primaryError?.message ?? ''}`);
  const dockerFailure =
    combined.includes('Docker Desktop is a prerequisite') || combined.includes('docker_engine');
  if (!dockerFailure) {
    throw primaryError;
  }

  if (!commandWorks(`${escapeArg(pgTools.pgDump)} --version`) || !commandWorks(`${escapeArg(pgTools.pgDumpAll)} --version`)) {
    fail(
      'Docker-based backup failed and native PostgreSQL client tools were not found. Install PostgreSQL client tools, or set SUPABASE_PG_BIN_DIR to the folder containing pg_dump/pg_dumpall.',
    );
  }

  console.log(`[Supabase backup] Docker-based dump unavailable. Falling back to native PostgreSQL tools (${pgTools.source}).`);

  if (kind === 'schema') {
    runShell(
      `${escapeArg(pgTools.pgDump)} --dbname ${escapeArg(dbUrl)} --schema-only --schema ${escapeArg(schemaArg)} --no-owner --no-privileges --file ${escapeArg(outputFile)}`,
    );
    return;
  }
  if (kind === 'data') {
    runShell(
      `${escapeArg(pgTools.pgDump)} --dbname ${escapeArg(dbUrl)} --data-only --schema ${escapeArg(schemaArg)} --file ${escapeArg(outputFile)}`,
    );
    return;
  }
  if (kind === 'roles') {
    runShell(
      `${escapeArg(pgTools.pgDumpAll)} --dbname ${escapeArg(dbUrl)} --roles-only > ${escapeArg(outputFile)}`,
    );
    return;
  }

  throw primaryError;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sha256(input) {
  const hash = createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

const envPath = '.env.backup.local';
const env = parseEnvFile(envPath);
const dbUrl = env.SUPABASE_DB_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  fail('SUPABASE_DB_URL is required in .env.backup.local (never commit this file).');
}
const pgTools = resolvePgTools(env);
let dbHost = 'invalid-url';
try {
  dbHost = new URL(dbUrl).host;
} catch {
  dbHost = 'invalid-url';
}
console.log(`[Supabase backup] Source database host: ${dbHost}`);

const backupRoot = path.resolve(env.SUPABASE_BACKUP_DIR || 'backups/supabase');
const retentionDays = toPositiveInt(env.SUPABASE_BACKUP_RETENTION_DAYS, 14);
const schemaList = (env.SUPABASE_BACKUP_SCHEMAS || 'public,auth,storage')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const schemaArg = schemaList.join(',');

mkdirSync(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, 'Z');
const outDir = path.join(backupRoot, stamp);
mkdirSync(outDir, { recursive: true });

const schemaFile = path.join(outDir, 'schema.sql');
const dataFile = path.join(outDir, 'data.sql');
const rolesFile = path.join(outDir, 'roles.sql');
const checksumsFile = path.join(outDir, 'checksums.sha256');
const metaFile = path.join(outDir, 'meta.json');

console.log(`\n[Supabase backup] Writing backup set: ${outDir}`);
console.log(`[Supabase backup] Schemas: ${schemaArg}`);

try {
  runSupabase(['db', 'dump', '--db-url', dbUrl, '--schema', schemaArg, '--file', schemaFile, '--keep-comments']);
} catch (error) {
  maybeFallbackToNativePgDump('schema', dbUrl, schemaArg, schemaFile, error, pgTools);
}
try {
  runSupabase(['db', 'dump', '--db-url', dbUrl, '--data-only', '--schema', schemaArg, '--use-copy', '--file', dataFile]);
} catch (error) {
  maybeFallbackToNativePgDump('data', dbUrl, schemaArg, dataFile, error, pgTools);
}
try {
  runSupabase(['db', 'dump', '--db-url', dbUrl, '--role-only', '--file', rolesFile]);
} catch (error) {
  maybeFallbackToNativePgDump('roles', dbUrl, schemaArg, rolesFile, error, pgTools);
}

const outputs = [schemaFile, dataFile, rolesFile];
for (const file of outputs) {
  const size = statSync(file).size;
  if (size <= 0) {
    fail(`Backup file is empty: ${file}`);
  }
}

const checksums = outputs
  .map((file) => {
    const contents = readFile(file);
    return `${sha256(contents)}  ${path.basename(file)}`;
  })
  .join('\n');
writeFileSync(checksumsFile, `${checksums}\n`, 'utf8');

const meta = {
  createdAt: new Date().toISOString(),
  source: 'supabase db dump',
  schemas: schemaList,
  files: outputs.map((f) => path.basename(f)),
};
writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
const now = Date.now();
for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const fullPath = path.join(backupRoot, entry.name);
  if (fullPath === outDir) continue;
  const ageMs = now - statSync(fullPath).mtimeMs;
  if (ageMs > retentionMs) {
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`[Supabase backup] Pruned old backup set: ${entry.name}`);
  }
}

console.log('\n[Supabase backup] Completed successfully.');
console.log(`[Supabase backup] Verify files in: ${outDir}\n`);
