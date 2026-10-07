#!/usr/bin/env node
// Counts the words Claude Code loads into every session from the templates:
//   - templates/CLAUDE.md
//   - rules in templates/.claude/rules without a `paths:` front-matter key
//   - the `description` of every skill and agent
// Two checks, both must pass:
//   1. always loaded               <= LIMIT words
//   2. worst case: always loaded + every path-scoped rule (TypeScript and AWS
//      rules load as soon as matching files are read or edited) <= WORST_LIMIT words
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const LIMIT = 2300;
const WORST_LIMIT = 2300;
const ROOT = new URL('..', import.meta.url).pathname;
const T = join(ROOT, 'templates');

const words = (text) => text.split(/\s+/).filter(Boolean).length;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function splitFrontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: '', body: text };
}

function description(fm) {
  const m = /^description:\s*(.*)$/m.exec(fm);
  return m ? m[1].replace(/^["']|["']$/g, '') : '';
}

const always = [];
const scoped = [];

always.push({ file: 'templates/CLAUDE.md', words: words(readFileSync(join(T, 'CLAUDE.md'), 'utf8')) });

for (const file of walk(join(T, '.claude/rules')).filter((f) => f.endsWith('.md')).sort()) {
  const { fm, body } = splitFrontMatter(readFileSync(file, 'utf8'));
  const entry = { file: relative(ROOT, file), words: words(body) };
  if (/^paths:/m.test(fm)) scoped.push(entry);
  else always.push(entry);
}

const descFiles = [
  ...walk(join(T, '.claude/skills')).filter((f) => f.endsWith('SKILL.md')),
  ...walk(join(T, '.claude/agents')).filter((f) => f.endsWith('.md'))
].sort();
for (const file of descFiles) {
  const { fm } = splitFrontMatter(readFileSync(file, 'utf8'));
  always.push({ file: `${relative(ROOT, file)} (description)`, words: words(description(fm)) });
}

const total = always.reduce((s, e) => s + e.words, 0);
const scopedTotal = scoped.reduce((s, e) => s + e.words, 0);

console.log('Always loaded');
console.table(always);
console.log('Path-scoped (loaded when matching files are read or edited)');
console.table(scoped);
const worst = total + scopedTotal;
console.log(`Always loaded: ${total} words (~${Math.round(total * 1.3)} tokens), limit ${LIMIT}`);
console.log(`Worst case (always + path-scoped rules): ${worst} words (~${Math.round(worst * 1.3)} tokens), limit ${WORST_LIMIT}`);

let failed = false;
if (total > LIMIT) {
  console.error(`FAIL: always-loaded context is ${total - LIMIT} words over the limit.`);
  failed = true;
}
if (worst > WORST_LIMIT) {
  console.error(`FAIL: worst-case context is ${worst - WORST_LIMIT} words over the limit. Move examples from rules into skills.`);
  failed = true;
}
if (failed) process.exit(1);
console.log('PASS');
