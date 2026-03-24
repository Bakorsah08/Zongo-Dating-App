#!/usr/bin/env node
import { execSync } from 'node:child_process';

function getStagedFiles() {
  const output = execSync('git diff --cached --name-only --diff-filter=ACMRTUXB', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getFileContentFromIndex(file) {
  try {
    return execSync(`git show :${file}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

const ALLOWLIST_PATHS = [
  /\.env\.example$/i,
  /^README\.md$/i,
  /^supabase\/SETUP\.txt$/i,
];

const BLOCK_PATTERNS = [
  { name: 'Supabase service role key var', regex: /SUPABASE_SERVICE_ROLE_KEY\s*=/i },
  { name: 'Supabase secret token prefix', regex: /sb_secret_[a-zA-Z0-9_-]{16,}/ },
  { name: 'Google API key literal', regex: /AIza[0-9A-Za-z\-_]{30,}/ },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Hardcoded bearer token', regex: /Bearer\s+[A-Za-z0-9._-]{30,}/ },
];

function isAllowlisted(path) {
  return ALLOWLIST_PATHS.some((rule) => rule.test(path));
}

function scan() {
  const files = getStagedFiles();
  if (files.length === 0) {
    console.log('Secret scan: no staged files.');
    return 0;
  }

  const findings = [];
  for (const file of files) {
    if (isAllowlisted(file)) continue;
    const content = getFileContentFromIndex(file);
    if (!content) continue;
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({ file, rule: pattern.name });
      }
    }
  }

  if (findings.length === 0) {
    console.log('Secret scan passed.');
    return 0;
  }

  console.error('\nSecret scan failed. Potential secrets detected in staged content:\n');
  for (const f of findings) {
    console.error(`- ${f.file}: ${f.rule}`);
  }
  console.error('\nIf this is intentional, remove the secret or move it to secure server-side secret storage.');
  return 1;
}

process.exit(scan());
