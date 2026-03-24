#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hooksDir = path.join(root, '.git', 'hooks');
const preCommitPath = path.join(hooksDir, 'pre-commit');

const hookScript = `#!/usr/bin/env sh
npm run check:secrets
`;

try {
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(preCommitPath, hookScript, { encoding: 'utf8', mode: 0o755 });
  console.log('Installed git pre-commit hook: runs npm run check:secrets');
} catch (error) {
  console.error('Failed to install git hook.', error);
  process.exit(1);
}
