#!/usr/bin/env node
// Parses every .json file in the repository (except node_modules and .git).
// Exits 1 if any file is not valid JSON.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', '.git']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let failed = 0;
for (const file of walk(ROOT).filter((f) => f.endsWith('.json')).sort()) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
    console.log(`ok    ${relative(ROOT, file)}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${relative(ROOT, file)}: ${err.message}`);
  }
}
if (failed) process.exit(1);
console.log('PASS: all JSON files are valid.');
