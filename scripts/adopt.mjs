#!/usr/bin/env node
// Adopts the team AI standard in an existing (or empty) project repository.
// Run from the project repository:
//   node <path-to-standard>/scripts/adopt.mjs --profile strict|standard [selection] [--with-docs] [--dry-run] [--yes]
// Selection (each dimension is detected from package.json unless given):
//   --framework nestjs|express|none   --db mysql|postgres (repeat or comma-separate)
//   --data-access typeorm|raw|none    --with aws (optional fragments)
//   (framework none: service without a web framework; data access none: no database.
//    The lists live in templates/fragments/fragments.json)
//   --stack nestjs-mysql|nestjs-postgres|node-postgres   alias that sets all dimensions
// Detection is never applied silently: a real run needs explicit flags for every
// dimension, or --yes to accept what --dry-run showed. Ambiguous detection stops.
//
// It never overwrites an existing file: when a file exists, it writes
// <file>.proposed next to it and adds a step to the merge checklist.
// It never commits, pushes, installs packages or uses the network.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CODEOWNERS_KEY, CODEOWNERS_LOCATIONS, COMMAND_CANDIDATES, DIMENSIONS, claudeSkeleton, codeownersPlaceholders,
  codeownersTemplate, coreFiles, describe, detect, expandAlias, FLAG_FOR, hash, normalize, optionalFiles, prTemplate,
  registry, summary, validate, version
} from './lib/standard.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? args[i + 1].split(',') : [])).map((x) => x.trim()).filter(Boolean);
const DRY = args.includes('--dry-run');
const YES = args.includes('--yes');
const WITH_DOCS = args.includes('--with-docs');
const TARGET = opt('target', process.cwd());
const profile = opt('profile', 'strict');
const die = (code, msg) => {
  console.error(`adopt: ${msg}`);
  process.exit(code);
};

const placeholders = codeownersPlaceholders();
if (placeholders.length) {
  die(2, `the standard is not ready for adoption: templates/.github/CODEOWNERS still has placeholder owners in the team-ai-standard block (${placeholders.join(', ')}). The owner of the standard must replace them with the real GitHub team (for example @<org>/ai-standard-owners) first.`);
}
if (!['strict', 'standard'].includes(profile)) die(2, '--profile must be strict (client repositories, default) or standard (internal repositories only).');

const exists = (p) => existsSync(join(TARGET, p));
const read = (p) => readFileSync(join(TARGET, p), 'utf8');

if (exists('.claude/project.json')) {
  const v = exists('.claude/STANDARD_VERSION') ? read('.claude/STANDARD_VERSION').trim() : 'unknown';
  console.log(`This repository already uses the team AI standard (version ${v}).`);
  console.log('New versions arrive as update pull requests. Project settings live in .claude/project.json.');
  process.exit(0);
}

// --- stack selection --------------------------------------------------------------
const detected = detect(TARGET);
const source = Object.fromEntries(DIMENSIONS.map((d) => [d, 'detected']));
let selection = detected.selection;
const stackAlias = opt('stack');
if (stackAlias) {
  try {
    selection = expandAlias(stackAlias);
  } catch (err) {
    die(2, err.message);
  }
  for (const d of DIMENSIONS) source[d] = `--stack ${stackAlias}`;
}
const flagFor = { framework: opt('framework'), databases: all('db'), dataAccess: opt('data-access'), optional: all('with') };
if (flagFor.framework) { selection.framework = flagFor.framework; source.framework = 'flag'; }
if (flagFor.databases.length) { selection.databases = flagFor.databases; source.databases = 'flag'; }
if (flagFor.dataAccess) { selection.dataAccess = flagFor.dataAccess; source.dataAccess = 'flag'; }
if (flagFor.optional.length) { selection.optional = flagFor.optional; source.optional = 'flag'; }
if (args.includes('--without-optional')) { selection.optional = []; source.optional = 'flag'; }
selection = normalize(selection);

const unresolved = detected.ambiguous.filter((a) => source[a.dimension] === 'detected');
const reg = registry().dimensions;
const options = () => DIMENSIONS.map((d) => `  ${d.padEnd(11)} ${Object.keys(reg[d].values).join(' | ')}`).join('\n');
if (unresolved.length) {
  console.error('adopt: stack detection is ambiguous; nothing was written.');
  for (const a of unresolved) console.error(`  ${a.dimension}: found ${a.options.join(' and ')} — choose with ${a.hint}`);
  console.error(`\nOptions:\n${options()}\nAliases: ${Object.keys(registry().aliases).join(', ')}`);
  process.exit(3);
}

// Dependencies without a fragment: stop unless that dimension was chosen explicitly
const stopping = detected.unsupported.filter((u) => source[u.dimension] === 'detected');
if (stopping.length) {
  console.error('adopt: this repository uses something the team standard has no fragment for; nothing was written.');
  for (const u of stopping) {
    const what = { framework: 'framework', dataAccess: 'data-access' }[u.dimension] || u.dimension;
    console.error(`  ${u.dep}: no ${what} fragment exists for this dependency.`);
    console.error(`    Either add a fragment first (docs/en/11-adding-a-stack-fragment.md),`);
    console.error(`    or choose explicitly with ${FLAG_FOR[u.dimension]} ${Object.keys(reg[u.dimension].values).join('|')}; the dependency is then recorded`);
    console.error('    as acknowledged in .claude/project.json ("acknowledgedUnsupported") so reviewers can see it.');
  }
  process.exit(3);
}
const acknowledgedUnsupported = detected.unsupported.map((u) => u.dep).sort();

const { errors, warnings } = validate(selection);
if (errors.length) die(2, `invalid stack selection:\n  ${errors.join('\n  ')}\n\nOptions:\n${options()}`);

const detectedDims = DIMENSIONS.filter((d) => source[d] === 'detected');
const flagsFor = (sel) => [`--framework ${sel.framework}`, ...(sel.databases.length ? [`--db ${sel.databases.join(',')}`] : []), `--data-access ${sel.dataAccess}`, sel.optional.length ? `--with ${sel.optional.join(',')}` : '--without-optional'].join(' ');

console.log(`Team AI standard ${version()} — profile ${profile}${DRY ? ' — DRY RUN, nothing is written' : ''}`);
console.log(`Stack: ${describe(selection)} (${summary(selection)})`);
for (const d of DIMENSIONS) {
  const v = Array.isArray(selection[d]) ? (selection[d].join(', ') || '(none)') : selection[d];
  console.log(`  ${d.padEnd(11)} ${String(v).padEnd(18)} ${source[d]}`);
}
if (detectedDims.length) for (const n of detected.notes) console.log(`  note: ${n}`);
for (const w of warnings) console.log(`warning: ${w}`);
if (acknowledgedUnsupported.length) console.log(`note: no fragment exists for ${acknowledgedUnsupported.join(', ')}; your explicit choice will be recorded in .claude/project.json as acknowledgedUnsupported.`);

if (!DRY && detectedDims.length && !YES) {
  console.error(`\nadopt: ${detectedDims.join(', ')} ${detectedDims.length === 1 ? 'was' : 'were'} detected, not given. Nothing was written.`);
  console.error('Check the selection above, then run again with --yes, or pass the flags explicitly:');
  console.error(`  node <path-to-standard>/scripts/adopt.mjs --profile ${profile} ${flagsFor(selection)}`);
  process.exit(3);
}

// --- what the repository already has ----------------------------------------
const pkg = exists('package.json') ? JSON.parse(read('package.json')) : null;
const scripts = (pkg && pkg.scripts) || {};
const manager = exists('pnpm-lock.yaml') ? 'pnpm' : exists('yarn.lock') ? 'yarn' : 'npm';
const runScript = (name) => {
  if (manager === 'npm') return name === 'test' ? 'npm test' : `npm run ${name}`;
  return `${manager} ${name}`;
};
const installCmd = { npm: exists('package-lock.json') ? 'npm ci' : 'npm install', pnpm: 'pnpm install --frozen-lockfile', yarn: 'yarn install --frozen-lockfile' }[manager];

const commands = { install: pkg ? installCmd : null };
const matched = {};
for (const [key, candidates] of Object.entries(COMMAND_CANDIDATES)) {
  const name = candidates.find((c) => c in scripts);
  commands[key] = name ? runScript(name) : null;
  if (name) matched[key] = name;
}

// --- plan -------------------------------------------------------------------
const plan = []; // { path, content, mode: 'create' | 'propose', layer, note }
const layer1 = new Set();
function add(path, content, layer, note = '') {
  if (exists(path)) {
    if (read(path) === content) return; // already identical
    plan.push({ path: `${path}.proposed`, content, mode: 'propose', layer, original: path, note });
  } else {
    plan.push({ path, content, mode: 'create', layer, note });
    if (layer === 1) layer1.add(path);
  }
}

for (const f of coreFiles(selection)) add(f.path, f.content, 1);
if (WITH_DOCS) for (const f of optionalFiles('docs')) add(f.path, f.content, 1);

const project = {
  stack: selection,
  acknowledgedUnsupported,
  profile,
  hooks: false,
  commands,
  permissions: { allow: [], ask: [], deny: [] }
};
add('.claude/project.json', `${JSON.stringify(project, null, 2)}\n`, 2);
add('.claude/rules/local/.gitkeep', '', 2);
add('CLAUDE.md', claudeSkeleton(selection, profile), 2);
add('.github/pull_request_template.md', prTemplate(), 1);

const co = codeownersTemplate();
const coPath = CODEOWNERS_LOCATIONS.find(exists);
if (coPath) {
  plan.push({ path: `${coPath}.proposed`, content: `${read(coPath).replace(/\s*$/, '\n')}\n${co.block}\n`, mode: 'propose', layer: 1, original: coPath, note: 'your file with the standard block appended at the end' });
} else {
  plan.push({ path: '.github/CODEOWNERS', content: co.full, mode: 'create', layer: 1, note: 'fill in <org>/<repo-team>' });
  layer1.add(`.github/CODEOWNERS${CODEOWNERS_KEY}`);
}
const settingsTarget = exists('.claude/settings.json') ? '.claude/settings.json.proposed' : '.claude/settings.json';
plan.push({ path: settingsTarget, content: null, mode: settingsTarget.endsWith('.proposed') ? 'propose' : 'create', layer: 1, original: '.claude/settings.json', note: 'generated from the base profile and .claude/project.json' });
if (!settingsTarget.endsWith('.proposed')) layer1.add('.claude/settings.json');
plan.push({ path: '.claude/std/manifest.json', content: null, mode: 'create', layer: 1, note: 'hashes of the standard files' });

const proposals = plan.filter((p) => p.mode === 'propose');

// --- print plan ---------------------------------------------------------------
console.log('\nPlan:');
for (const p of plan) console.log(`  ${p.mode === 'create' ? 'create ' : 'propose'}  L${p.layer}  ${p.path}${p.note ? `  (${p.note})` : ''}`);
console.log('\nCommands found in package.json:');
for (const [key, value] of Object.entries(commands)) console.log(`  ${key.padEnd(19)} ${value || 'TODO (not found)'}${matched[key] ? `  ← "${matched[key]}"` : ''}`);

if (DRY) {
  console.log('\nDry run: no files were written.');
  process.exit(0);
}

// --- write ------------------------------------------------------------------------
for (const p of plan) {
  if (p.content === null) continue;
  mkdirSync(dirname(join(TARGET, p.path)), { recursive: true });
  writeFileSync(join(TARGET, p.path), p.content);
}

// settings.json and the CLAUDE.md command table, with the repository's own compose script
const claudeTarget = exists('CLAUDE.md.proposed') ? 'CLAUDE.md.proposed' : 'CLAUDE.md';
execFileSync('node', [join(TARGET, '.claude/std/compose-settings.mjs'), '--root', TARGET, '--settings-out', settingsTarget, '--claude-md', claudeTarget], { stdio: ['ignore', 'ignore', 'inherit'] });

// manifest: only the standard files this run actually created
const files = {};
for (const path of [...layer1].sort()) {
  if (path.endsWith(CODEOWNERS_KEY)) files[path] = hash(co.block);
  else files[path] = hash(read(path));
}
writeFileSync(join(TARGET, '.claude/std/manifest.json'), `${JSON.stringify({ standardVersion: version(), stack: selection, files }, null, 2)}\n`);

// merge checklist for proposals
if (proposals.length) {
  const lines = [
    '# Team AI standard: merge checklist',
    '',
    'Adoption found existing files and did not change them. For each item, compare the `.proposed` file with your file, merge, then delete the `.proposed` file. Delete this checklist when done.',
    ''
  ];
  for (const p of proposals) {
    if (p.original === '.claude/settings.json') lines.push('- [ ] `.claude/settings.json`: move project-specific rules into `permissions` in `.claude/project.json`, run `node .claude/std/compose-settings.mjs --settings-out .claude/settings.json.proposed`, then replace `.claude/settings.json` with the proposal.');
    else if (p.original === 'CLAUDE.md') lines.push('- [ ] `CLAUDE.md`: move your existing content into the `TODO(adopt)` sections of `CLAUDE.md.proposed`, keep the `std-commands` markers, then replace `CLAUDE.md`.');
    else if (p.original && p.original.endsWith('CODEOWNERS')) lines.push(`- [ ] \`${p.original}\`: replace it with \`${p.path}\` (your file with the standard block at the end); fill in the owners.`);
    else if (p.original === '.github/pull_request_template.md') lines.push('- [ ] `.github/pull_request_template.md`: replace it with the proposal. The standard template is managed; project-specific checks belong in `.claude/rules/local/` or CI.');
    else lines.push(`- [ ] \`${p.original}\`: compare with \`${p.path}\` and replace.`);
  }
  lines.push('- [ ] Run `node .claude/std/compose-settings.mjs --check`.', '');
  writeFileSync(join(TARGET, '.claude/std-adoption-checklist.md'), lines.join('\n'));
}

// --- what the developer does next ---------------------------------------------
const claudeNow = read(claudeTarget);
const todos = (claudeNow.match(/TODO\(adopt\)/g) || []).length;
const missing = Object.entries(commands).filter(([, v]) => !v).map(([k]) => k);
const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const steps = [];
steps.push(`Fill in ${todos} TODO(adopt) item(s) in ${claudeTarget} (about 20 minutes).`);
if (missing.length) steps.push(`Set these commands in .claude/project.json, or leave them null if the repository has none: ${missing.join(', ')}. Then run: node .claude/std/compose-settings.mjs`);
steps.push('Replace <org>/<repo-team> in CODEOWNERS with your team.');
if (proposals.length) steps.push(`Merge ${proposals.length} proposed file(s): see .claude/std-adoption-checklist.md`);
if (!/settings\.local\.json/.test(gitignore)) steps.push('Add .claude/settings.local.json to .gitignore.');
if (!/\.proposed/.test(gitignore) && proposals.length) steps.push('Do not commit *.proposed files (delete them after merging).');
steps.push('Check: node .claude/std/compose-settings.mjs --check');
steps.push('Open a PR, and ask the owner of the standard to add this repository to .github/standard-targets.json.');

console.log('\nDone. Next steps:');
steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
