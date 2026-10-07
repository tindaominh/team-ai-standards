#!/usr/bin/env node
// Checks that docs/en and docs/vi have the same files and the same structure:
// heading tree (levels + numeric prefixes), checklist items, table rows and
// code blocks. Exits 1 on any mismatch. No dependencies.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const EN = join(ROOT, 'docs/en');
const VI = join(ROOT, 'docs/vi');
// Files that intentionally exist in one language only.
const ONLY_VI = new Set(['ai-files-explained.md']);
const ONLY_EN = new Set();

function structure(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const headings = [];
  let checkboxes = 0;
  let tableRows = 0;
  let codeBlocks = 0;
  let inCode = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inCode) codeBlocks += 1;
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      // Keep the level and a leading number such as "01." or "2.3" so that
      // translated headings still compare equal.
      const num = /^(\d+(?:\.\d+)*\.?)/.exec(h[2]);
      headings.push(`${h[1].length}${num ? ` ${num[1]}` : ''}`);
    }
    if (/^\s*[-*] \[[ xX]\]/.test(line)) checkboxes += 1;
    if (/^\s*\|/.test(line)) tableRows += 1;
  }
  return { headings, checkboxes, tableRows, codeBlocks };
}

const list = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const en = list(EN);
const vi = list(VI);
const errors = [];

for (const f of en) if (!vi.includes(f) && !ONLY_EN.has(f)) errors.push(`missing in docs/vi: ${f}`);
for (const f of vi) if (!en.includes(f) && !ONLY_VI.has(f)) errors.push(`missing in docs/en: ${f}`);

const rows = [];
for (const f of en.filter((x) => vi.includes(x))) {
  const a = structure(join(EN, f));
  const b = structure(join(VI, f));
  const tree = a.headings.join('|') === b.headings.join('|');
  const ok = tree && a.checkboxes === b.checkboxes && a.tableRows === b.tableRows && a.codeBlocks === b.codeBlocks;
  rows.push({
    file: f,
    headings: `${a.headings.length}/${b.headings.length}${tree ? '' : ' (tree differs)'}`,
    checkboxes: `${a.checkboxes}/${b.checkboxes}`,
    tableRows: `${a.tableRows}/${b.tableRows}`,
    codeBlocks: `${a.codeBlocks}/${b.codeBlocks}`,
    result: ok ? 'PASS' : 'FAIL'
  });
  if (!ok) {
    errors.push(`structure differs: ${f}`);
    if (!tree) {
      const n = Math.max(a.headings.length, b.headings.length);
      for (let i = 0; i < n; i += 1) {
        if (a.headings[i] !== b.headings[i]) {
          errors.push(`  first heading difference at #${i + 1}: en "${a.headings[i]}" vs vi "${b.headings[i]}"`);
          break;
        }
      }
    }
  }
}

console.log('Bilingual parity (en/vi)');
console.table(rows);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: docs/en and docs/vi match.');
