#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): checks whether the edited file is
// formatted, using the project's local Prettier in check mode. If it is not,
// it reminds Claude through `additionalContext`. It never writes any file,
// never uses the network, and always exits 0.
//   Reads:    stdin JSON (tool_input.file_path, cwd), the edited file
//   Executes: <project>/node_modules/.bin/prettier --check <file>
//   Writes:   nothing (one JSON line on stdout for Claude Code)
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
  if (!fs.existsSync(bin)) return; // Prettier not installed locally: nothing to check.

  const result = spawnSync(bin, ['--check', '--log-level', 'silent', target], {
    cwd: projectDir,
    timeout: 20000,
    encoding: 'utf8'
  });
  if (result.status === 1) {
    const rel = path.relative(projectDir, target);
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Reminder: ${rel} is not formatted according to the project's Prettier config. Format it before finishing (ask the developer to run the formatter, or match the existing style).`
      }
    })}\n`);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`[format-check-on-edit] skipped: ${err.message}\n`);
}
process.exit(0);
