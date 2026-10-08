#!/usr/bin/env node
// Writes generated sections between <!-- AUTO-GENERATED:<name> START --> and
// <!-- AUTO-GENERATED:<name> END -->:
//   README.md                      adopt-options (English table), adopt-options-vi
//                                  (Vietnamese table), from scripts/lib/adopt-options.mjs
//   docs/{en,vi}/12-new-project.md prompt-01 … prompt-05, the text of
//                                  templates/prompts/0N-*.md
// Why the check exists: the README documents every adoption option and doc 12 shows
// the prompts; text edited by hand drifts from the parser, --help and the prompt
// files, and readers then pass options that do not exist or copy an old prompt.
//   node scripts/generate-readme.mjs                 write the files
//   node scripts/generate-readme.mjs --check         exit 1 if any file is stale
//   --readme <path>                                  only this file, with the README sections (tests)
//   --prompts-doc <path>                             only this file, with the prompt sections (tests)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { optionsTable } from './lib/adopt-options.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const i = args.indexOf('--readme');
const j = args.indexOf('--prompts-doc');
const CHECK = args.includes('--check');
const README_SECTIONS = { 'adopt-options': optionsTable('en'), 'adopt-options-vi': optionsTable('vi') };
const PROMPTS = join(ROOT, 'templates/prompts');
const promptSections = () => Object.fromEntries(readdirSync(PROMPTS).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()
  .map((f) => [`prompt-${f.slice(0, 2)}`, `\`\`\`text\n${readFileSync(join(PROMPTS, f), 'utf8').trim()}\n\`\`\``]));
const FILES = i > -1 ? [[args[i + 1], README_SECTIONS]] : j > -1 ? [[args[j + 1], promptSections()]] : [[join(ROOT, 'README.md'), README_SECTIONS], ...['en', 'vi'].map((lang) => [join(ROOT, `docs/${lang}/12-new-project.md`), promptSections()])];

let failed = false;
for (const [file, sections] of FILES) {
  const text = readFileSync(file, 'utf8');
  let next = text;
  const missing = [];
  for (const [name, body] of Object.entries(sections)) {
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
    failed = true;
  } else if (CHECK && next !== text) {
    console.error(`FAIL: generated sections in ${file} are stale. Run: npm run docs:readme`);
    failed = true;
  } else if (!CHECK && next !== text) {
    writeFileSync(file, next);
    console.log(`updated generated sections in ${file}`);
  }
}
if (failed) process.exit(1);
if (CHECK) console.log('PASS: README option tables and doc 12 prompts match their sources.');
