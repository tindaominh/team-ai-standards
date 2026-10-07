#!/usr/bin/env node
// Counts the words Claude Code loads from the standard.
//   Always loaded: templates/CLAUDE.md, rules without a `paths:` key, and the
//                  `description` of every skill and agent.
//   Worst case:    always loaded + shared path-scoped rules + the fragment rules
//                  of a stack selection, as when all matching files are touched
//                  in one session. Computed for EVERY valid combination of the
//                  fragments in templates/fragments/fragments.json.
// Fails when the always-loaded part or any combination exceeds the limits, or
// when a fragment rule is longer than the registry's word limit.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIMENSIONS, F, ROOT, T, registry, selectedFragments, summary, validate, walk } from './lib/standard.mjs';

const LIMIT = 2300;
const WORST_LIMIT = 2300;

const words = (text) => text.split(/\s+/).filter(Boolean).length;
function split(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: '', body: text };
}
const description = (fm) => {
  const m = /^description:\s*(.*)$/m.exec(fm);
  return m ? m[1] : '';
};

const always = [{ file: 'templates/CLAUDE.md', words: words(readFileSync(join(T, 'CLAUDE.md'), 'utf8')) }];
const sharedScoped = [];
for (const file of walk(join(T, '.claude/rules/std')).filter((f) => f.endsWith('.md')).sort()) {
  const { fm, body } = split(readFileSync(file, 'utf8'));
  (/^paths:/m.test(fm) ? sharedScoped : always).push({ file: relative(ROOT, file), words: words(body) });
}
for (const file of [...walk(join(T, '.claude/skills')).filter((f) => f.endsWith('SKILL.md')), ...walk(join(T, '.claude/agents'))].sort()) {
  always.push({ file: `${relative(ROOT, file)} (description)`, words: words(description(split(readFileSync(file, 'utf8')).fm)) });
}
const sum = (list) => list.reduce((s, e) => s + e.words, 0);
const alwaysTotal = sum(always);
const sharedTotal = sum(sharedScoped);

// Every fragment rule, with its size and the per-fragment limit
const reg = registry();
const fragmentWords = {};
const fragmentRows = [];
let failed = false;
for (const dim of DIMENSIONS) {
  const { folder } = reg.dimensions[dim];
  for (const value of Object.keys(reg.dimensions[dim].values)) {
    const file = join(F, folder, value, 'rule.md');
    const w = existsSync(file) ? words(split(readFileSync(file, 'utf8')).body) : 0;
    fragmentWords[`${folder}-${value}`] = w;
    const ok = w <= reg.ruleWordLimit;
    if (!ok) failed = true;
    fragmentRows.push({ fragment: `${folder}/${value}`, words: w, result: ok ? 'PASS' : `FAIL (> ${reg.ruleWordLimit})` });
  }
}

// All valid combinations
const subsets = (list) => list.reduce((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);
const vals = (dim) => Object.keys(reg.dimensions[dim].values);
const combos = [];
for (const framework of vals('framework')) {
  for (const databases of subsets(vals('databases'))) {
    for (const dataAccess of vals('dataAccess')) {
      for (const optional of subsets(vals('optional'))) {
        const sel = { runtime: reg.runtime, framework, databases, dataAccess, optional };
        if (validate(sel).errors.length) continue;
        const fragments = sum(selectedFragments(sel).map((f) => ({ words: fragmentWords[f.name] || 0 })));
        combos.push({ sel, worst: alwaysTotal + sharedTotal + fragments });
      }
    }
  }
}
combos.sort((a, b) => b.worst - a.worst);
const worst = combos[0];

console.log('Always loaded');
console.table(always);
console.log('Path-scoped, shared by every selection');
console.table(sharedScoped);
console.log(`Fragment rules (limit ${reg.ruleWordLimit} words each)`);
console.table(fragmentRows);
console.log(`Valid combinations: ${combos.length}. Largest five:`);
console.table(combos.slice(0, 5).map((c) => ({ selection: summary(c.sel), 'worst case (words)': c.worst, '~tokens': Math.round(c.worst * 1.3) })));
console.log(`Always loaded: ${alwaysTotal} words (~${Math.round(alwaysTotal * 1.3)} tokens), limit ${LIMIT}`);
console.log(`Worst combination: ${summary(worst.sel)} = ${worst.worst} words (~${Math.round(worst.worst * 1.3)} tokens), limit ${WORST_LIMIT}`);

if (alwaysTotal > LIMIT) {
  console.error(`FAIL: always-loaded context is ${alwaysTotal - LIMIT} words over the limit.`);
  failed = true;
}
if (worst.worst > WORST_LIMIT) {
  console.error(`FAIL: ${summary(worst.sel)} is ${worst.worst - WORST_LIMIT} words over the limit. Shorten fragment rules; move examples into skills.`);
  failed = true;
}
if (failed) process.exit(1);
console.log('PASS');
