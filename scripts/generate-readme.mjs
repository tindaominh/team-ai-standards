#!/usr/bin/env node
// Writes the adopt.mjs option tables into README.md from scripts/lib/adopt-options.mjs,
// between <!-- AUTO-GENERATED:<name> START --> and <!-- AUTO-GENERATED:<name> END -->:
//   adopt-options      English table
//   adopt-options-vi   Vietnamese table
// Why the check exists: the README documents every adoption option; a table edited
// by hand drifts from the parser and --help, and readers then pass options that
// do not exist or miss stored ones.
//   node scripts/generate-readme.mjs                 write README.md
//   node scripts/generate-readme.mjs --check         exit 1 if README.md is stale
//   --readme <path>                                  another file (tests)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { optionsTable } from './lib/adopt-options.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const i = args.indexOf('--readme');
const file = i > -1 ? args[i + 1] : join(ROOT, 'README.md');
const CHECK = args.includes('--check');
const SECTIONS = { 'adopt-options': optionsTable('en'), 'adopt-options-vi': optionsTable('vi') };

const text = readFileSync(file, 'utf8');
let next = text;
const missing = [];
for (const [name, body] of Object.entries(SECTIONS)) {
  const start = `<!-- AUTO-GENERATED:${name} START -->`;
  const end = `<!-- AUTO-GENERATED:${name} END -->`;
  const a = next.indexOf(start);
  const b = next.indexOf(end);
  if (a < 0 || b < a) {
    missing.push(name);
    continue;
  }
  next = `${next.slice(0, a + start.length)}\n\n${body}\n\n${next.slice(b)}`;
}
if (missing.length) {
  console.error(`FAIL: ${file} has no AUTO-GENERATED markers for: ${missing.join(', ')}.`);
  process.exit(1);
}
if (CHECK) {
  if (next !== text) {
    console.error('FAIL: the adopt.mjs option tables in README.md are stale. Run: npm run docs:readme');
    process.exit(1);
  }
  console.log('PASS: README option tables match scripts/lib/adopt-options.mjs.');
} else if (next !== text) {
  writeFileSync(file, next);
  console.log(`updated option tables in ${file}`);
}
