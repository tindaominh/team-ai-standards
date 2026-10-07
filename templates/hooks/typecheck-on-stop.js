#!/usr/bin/env node
// Stop hook: runs the project's local TypeScript compiler (tsc --noEmit) when
// Claude finishes a turn. If there are type errors, exits 2 so Claude sees
// them and continues fixing. Runs at most once per stop cycle
// (stop_hook_active guard). No network, no downloads.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_LINES = 30;

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const input = readStdin();
  if (input.stop_hook_active) return 0; // Already continued once because of this hook.

  const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const tsconfig = path.join(projectDir, 'tsconfig.json');
  const bin = path.join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  if (!fs.existsSync(tsconfig) || !fs.existsSync(bin)) return 0;

  const result = spawnSync(bin, ['--noEmit', '-p', tsconfig], {
    cwd: projectDir,
    timeout: 110000,
    encoding: 'utf8'
  });
  if (result.error) {
    process.stderr.write(`[typecheck-on-stop] skipped: ${result.error.message}\n`);
    return 0;
  }
  if (result.status === 0) return 0;

  const lines = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n');
  const shown = lines.slice(0, MAX_LINES).join('\n');
  const more = lines.length > MAX_LINES ? `\n... ${lines.length - MAX_LINES} more lines` : '';
  process.stderr.write(`[typecheck-on-stop] tsc --noEmit found errors. Fix them before finishing:\n${shown}${more}\n`);
  return 2;
}

let code = 0;
try {
  code = main();
} catch (err) {
  process.stderr.write(`[typecheck-on-stop] skipped: ${err.message}\n`);
}
process.exit(code);
