import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const MIGRATION_NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const ROLLBACK_NOTE = /--\s*Rollback:\s*\S+/i;

function fail(message) {
  console.error(`\n[Migration validation] ${message}\n`);
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  fail('No migration files found in supabase/migrations.');
}

let previousTimestamp = '';
const seenTimestamps = new Set();

for (const file of files) {
  const match = file.match(MIGRATION_NAME);
  if (!match) {
    fail(
      `Invalid migration filename "${file}". Use pattern YYYYMMDDHHmmss_description.sql in lowercase.`
    );
  }

  const timestamp = match[1];
  if (seenTimestamps.has(timestamp)) {
    fail(`Duplicate migration timestamp "${timestamp}" in "${file}".`);
  }
  seenTimestamps.add(timestamp);

  if (previousTimestamp && timestamp <= previousTimestamp) {
    fail(
      `Out-of-order migration "${file}". Timestamps must be strictly increasing across all files.`
    );
  }
  previousTimestamp = timestamp;

  const fullPath = join(MIGRATIONS_DIR, file);
  const rawBody = readFileSync(fullPath, 'utf8');
  const body = rawBody.trim();
  if (!body) {
    fail(`Migration "${file}" is empty.`);
  }

  if (!ROLLBACK_NOTE.test(rawBody)) {
    fail(
      `Migration "${file}" is missing rollback notes. Add a comment like "-- Rollback: <manual steps>" near the top.`
    );
  }
}

console.log(`[Migration validation] OK (${files.length} migrations checked).`);
