#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): formats the edited file with the
// project's local Prettier. Never downloads anything, never uses the network.
// Exit 0 always: formatting problems must not block the session.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const EXTENSIONS = new Set(['.ts', '.js', '.json', '.md', '.yml', '.yaml']);

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const input = readStdin();
  const filePath = input && input.tool_input && input.tool_input.file_path;
  if (!filePath) return;

  const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const target = path.resolve(projectDir, filePath);

  // Only files inside the project, never env/secret files.
  if (!target.startsWith(projectDir + path.sep)) return;
  if (/(^|[\\/])\.env/.test(target)) return;
  if (!EXTENSIONS.has(path.extname(target))) return;
  if (!fs.existsSync(target)) return;

  const bin = path.join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
  if (!fs.existsSync(bin)) return; // Prettier not installed locally: do nothing.

  const result = spawnSync(bin, ['--write', '--log-level', 'warn', target], {
    cwd: projectDir,
    timeout: 20000,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(`[format-on-edit] prettier failed for ${path.relative(projectDir, target)}\n`);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`[format-on-edit] skipped: ${err.message}\n`);
}
process.exit(0);
