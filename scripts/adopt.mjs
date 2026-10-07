#!/usr/bin/env node
// Adopts the team AI standard in an existing (or empty) project repository.
// Run from the project repository:
//   node <path-to-standard>/scripts/adopt.mjs --profile strict --dry-run   review everything
//   node <path-to-standard>/scripts/adopt.mjs --profile strict --yes       apply exactly that
// Selection (each dimension is detected from package.json unless given):
//   --framework nestjs|express|none   --db mysql|postgres (repeat or comma-separate)
//   --data-access typeorm|raw|none    --with aws | --without-optional
//   --stack nestjs-mysql|nestjs-postgres|node-postgres   alias that sets all dimensions
//   (the lists live in templates/fragments/fragments.json)
// Other flags: --with-docs, --repo-owner <@user|@org/team> (CODEOWNERS project owner),
//   --carry-allow | --drop-allow (existing allow rules the profile does not grant),
//   --propose-unresolved (write <file>.proposed for files that cannot be merged),
//   --plan <hash> (require this plan instead of the one recorded by --dry-run).
//
// Guarantees:
// - --dry-run prints every change (diffs of modified files) and a plan hash computed
//   from the standard version, the flags, the existing files and the result. --yes
//   recomputes it and stops if anything differs.
// - Project content is never deleted or rewritten: CLAUDE.md gets std blocks, the PR
//   template and CODEOWNERS get an appended block, settings.json is regenerated with
//   the repository's own stricter rules moved into .claude/project.json.
// - Permissions are never loosened automatically.
// - Existing files are modified only on a clean git working tree, off the default branch.
// - Decisions that need a human stop --yes. *.proposed files exist only for the
//   --propose-unresolved fallback. No commits, pushes, installs or network.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { applyBlocks, composeSettings, duplicateHeadings, insertBlocks, renderBlocks } from '../templates/.claude/std/compose.mjs';
import { unifiedDiff } from './lib/diff.mjs';
import { gitProblems } from './lib/git.mjs';
import { appendBlock, headings, mergeSettings } from './lib/merge.mjs';
import {
  CODEOWNERS_KEY, CODEOWNERS_LOCATIONS, COMMAND_CANDIDATES, DIMENSIONS, FLAG_FOR, MANAGED_MARKER, PR_BLOCK_RE, PR_KEY, T,
  claudeSkeleton, codeownersPlaceholders, codeownersTemplate, coreFiles, describe, detect, expandAlias, findBlock, hash,
  normalize, optionalFiles, prBlock, prTemplate, registry, summary, validate, version
} from './lib/standard.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? args[i + 1].split(',') : [])).map((x) => x.trim()).filter(Boolean);
const DRY = args.includes('--dry-run');
const YES = args.includes('--yes');
const PROPOSE = args.includes('--propose-unresolved');
const TARGET = resolve(opt('target', process.cwd()));
const profile = opt('profile', 'strict');
const repoOwner = opt('repo-owner');
const allowChoice = args.includes('--carry-allow') ? 'carry' : args.includes('--drop-allow') ? 'drop' : undefined;
const die = (code, msg) => {
  console.error(`adopt: ${msg}`);
  process.exit(code);
};

const placeholders = codeownersPlaceholders();
if (placeholders.length) {
  die(2, `the standard is not ready for adoption: templates/.github/CODEOWNERS still has placeholder owners in the team-ai-standard block (${placeholders.join(', ')}). The owner of the standard must replace them with the real GitHub team (for example @<org>/ai-standard-owners) first.`);
}
if (!['strict', 'standard'].includes(profile)) die(2, '--profile must be strict (client repositories, default) or standard (internal repositories only).');
if (args.includes('--carry-allow') && args.includes('--drop-allow')) die(2, 'pass either --carry-allow or --drop-allow, not both.');
if (repoOwner !== undefined && !/^@[A-Za-z0-9-]+(\/[A-Za-z0-9._-]+)?$/.test(repoOwner)) die(2, `--repo-owner must be @user or @org/team (got ${JSON.stringify(repoOwner)}).`);

const exists = (p) => existsSync(join(TARGET, p));
const read = (p) => readFileSync(join(TARGET, p), 'utf8');

if (exists('.claude/project.json')) {
  const v = exists('.claude/STANDARD_VERSION') ? read('.claude/STANDARD_VERSION').trim() : 'unknown';
  console.log(`Nothing to do: this repository already uses the team AI standard (version ${v}).`);
  console.log('New versions arrive as update pull requests. Project settings live in .claude/project.json.');
  if (exists('.claude/std-adoption-checklist.md')) console.log('Open items from adoption: .claude/std-adoption-checklist.md');
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

const reg = registry().dimensions;
const options = () => DIMENSIONS.map((d) => `  ${d.padEnd(11)} ${Object.keys(reg[d].values).join(' | ')}`).join('\n');
const unresolved = detected.ambiguous.filter((a) => source[a.dimension] === 'detected');
if (unresolved.length) {
  console.error('adopt: stack detection is ambiguous; nothing was written.\nDecisions required:');
  for (const a of unresolved) console.error(`  ${a.dimension}: found ${a.options.join(' and ')} — choose with ${a.hint}`);
  console.error(`\nOptions:\n${options()}\nAliases: ${Object.keys(registry().aliases).join(', ')}`);
  process.exit(3);
}
const stopping = detected.unsupported.filter((u) => source[u.dimension] === 'detected');
if (stopping.length) {
  console.error('adopt: this repository uses something the team standard has no fragment for; nothing was written.\nDecisions required:');
  for (const u of stopping) {
    const what = { framework: 'framework', dataAccess: 'data-access' }[u.dimension] || u.dimension;
    console.error(`  ${u.dep}: no ${what} fragment exists for this dependency.`);
    console.error('    Either add a fragment first (docs/en/11-adding-a-stack-fragment.md),');
    console.error(`    or choose explicitly with ${FLAG_FOR[u.dimension]} ${Object.keys(reg[u.dimension].values).join('|')}; the dependency is then recorded`);
    console.error('    as acknowledged in .claude/project.json ("acknowledgedUnsupported") so reviewers can see it.');
  }
  process.exit(3);
}
const acknowledgedUnsupported = detected.unsupported.map((u) => u.dep).sort();
const { errors, warnings } = validate(selection);
if (errors.length) die(2, `invalid stack selection:\n  ${errors.join('\n  ')}\n\nOptions:\n${options()}`);

const flagsFor = (sel) => [`--framework ${sel.framework}`, ...(sel.databases.length ? [`--db ${sel.databases.join(',')}`] : []), `--data-access ${sel.dataAccess}`, sel.optional.length ? `--with ${sel.optional.join(',')}` : '--without-optional'].join(' ');
if (!DRY && !YES) {
  console.error('adopt: nothing was written. Review the plan with --dry-run, then apply it with --yes:');
  console.error(`  node <path-to-standard>/scripts/adopt.mjs --profile ${profile} ${flagsFor(selection)} --dry-run`);
  console.error(`  node <path-to-standard>/scripts/adopt.mjs --profile ${profile} ${flagsFor(selection)} --yes`);
  process.exit(3);
}

// --- commands from package.json -------------------------------------------------------
const pkg = exists('package.json') ? JSON.parse(read('package.json')) : null;
const scripts = (pkg && pkg.scripts) || {};
const manager = exists('pnpm-lock.yaml') ? 'pnpm' : exists('yarn.lock') ? 'yarn' : 'npm';
const runScript = (name) => (manager === 'npm' ? (name === 'test' ? 'npm test' : `npm run ${name}`) : `${manager} ${name}`);
const installCmd = { npm: exists('package-lock.json') ? 'npm ci' : 'npm install', pnpm: 'pnpm install --frozen-lockfile', yarn: 'yarn install --frozen-lockfile' }[manager];
const commands = { install: pkg ? installCmd : null };
const matched = {};
for (const [key, candidates] of Object.entries(COMMAND_CANDIDATES)) {
  const name = candidates.find((c) => c in scripts);
  commands[key] = name ? runScript(name) : null;
  if (name) matched[key] = name;
}

// --- plan ---------------------------------------------------------------------------
// action: create | modify | propose | same. Only create/modify/propose write anything.
const actions = [];
const decisions = [];
const suggestions = [];
const manifest = {};
const conflict = (path, content, what) => {
  if (PROPOSE) actions.push({ path: `${path}.proposed`, action: 'propose', after: content, original: path, note: what });
  decisions.push({ file: path, what, resolve: 'remove or rename your file, or pass --propose-unresolved', proposable: true });
};
function standardFile(path, content) {
  if (!exists(path)) actions.push({ path, action: 'create', after: content });
  else if (read(path) !== content) return conflict(path, content, 'exists and differs from the standard file');
  else actions.push({ path, action: 'same', after: content });
  manifest[path] = hash(content);
}
for (const f of coreFiles(selection)) standardFile(f.path, f.content);
if (args.includes('--with-docs')) for (const f of optionalFiles('docs')) standardFile(f.path, f.content);

// settings.json: the repository's stricter rules move into project.json
const project = { stack: selection, acknowledgedUnsupported, profile, hooks: false, commands, permissions: { allow: [], ask: [], deny: [] } };
const base = JSON.parse(readFileSync(join(T, `.claude/std/settings.${profile}.json`), 'utf8'));
let merge = null;
if (exists('.claude/settings.json')) {
  merge = mergeSettings(read('.claude/settings.json'), composeSettings(base, project).settings, allowChoice);
  project.permissions = merge.extra;
  for (const d of merge.decisions) decisions.push({ ...d, proposable: !d.what.startsWith('allows') });
}
const settings = composeSettings(base, project).text;
if (!exists('.claude/settings.json')) actions.push({ path: '.claude/settings.json', action: 'create', after: settings });
else if (merge.decisions.some((d) => !d.what.startsWith('allows'))) {
  if (PROPOSE) actions.push({ path: '.claude/settings.json.proposed', action: 'propose', after: settings, original: '.claude/settings.json', note: 'generated settings; your file was not changed' });
} else if (read('.claude/settings.json') !== settings) actions.push({ path: '.claude/settings.json', action: 'modify', before: read('.claude/settings.json'), after: settings });
if (!(merge && merge.decisions.length)) manifest['.claude/settings.json'] = hash(settings);

const projectText = `${JSON.stringify(project, null, 2)}\n`;
actions.push({ path: '.claude/project.json', action: 'create', after: projectText, showDiff: true });
if (!exists('.claude/rules/local/.gitkeep')) actions.push({ path: '.claude/rules/local/.gitkeep', action: 'create', after: '' });

// CLAUDE.md: the standard owns only its std blocks
const blocks = renderBlocks(project);
if (exists('CLAUDE.md')) {
  const before = read('CLAUDE.md');
  const after = insertBlocks(before, blocks);
  if (after !== before) actions.push({ path: 'CLAUDE.md', action: 'modify', before, after });
  for (const d of duplicateHeadings(after)) suggestions.push(`CLAUDE.md:${d.line} "${d.heading}" may repeat the std "${d.block}" block; remove it by hand if so (not changed).`);
} else {
  actions.push({ path: 'CLAUDE.md', action: 'create', after: applyBlocks(claudeSkeleton(), blocks) });
}

// PR template: a managed file, or a std block appended to the repository's template
const pr = prTemplate();
if (!exists('.github/pull_request_template.md')) {
  actions.push({ path: '.github/pull_request_template.md', action: 'create', after: pr });
  manifest['.github/pull_request_template.md'] = hash(pr);
} else {
  const before = read('.github/pull_request_template.md');
  const { inner, text } = prBlock();
  let after;
  if (PR_BLOCK_RE.test(before)) after = before.replace(PR_BLOCK_RE, () => text);
  else if (before.includes(MANAGED_MARKER)) after = pr;
  else after = appendBlock(before, text);
  if (after !== before) actions.push({ path: '.github/pull_request_template.md', action: 'modify', before, after });
  if (after === pr) manifest['.github/pull_request_template.md'] = hash(pr);
  else {
    manifest[PR_KEY] = hash(inner);
    const ours = new Set(headings(pr).map((h) => h.text.toLowerCase()));
    for (const h of headings(before)) if (ours.has(h.text.toLowerCase())) suggestions.push(`.github/pull_request_template.md:${h.line} "${h.text}" repeats a section of the standard block; remove it by hand if so (not changed).`);
  }
}

// CODEOWNERS: the standard block is appended (or refreshed); a new file needs the project owner
const co = codeownersTemplate();
const coPath = CODEOWNERS_LOCATIONS.find(exists);
if (coPath) {
  const before = read(coPath);
  const found = findBlock(before);
  const after = found ? before.slice(0, found.start) + co.block + before.slice(found.end) : appendBlock(before, co.block);
  if (after !== before) actions.push({ path: coPath, action: 'modify', before, after });
  manifest[`${coPath}${CODEOWNERS_KEY}`] = hash(co.block);
} else if (!repoOwner) {
  decisions.push({ file: '.github/CODEOWNERS', what: 'needs the owner of this repository\'s project files', resolve: 'pass --repo-owner @org/team (or @user)' });
} else {
  const full = co.full.replace(/^# TODO\(adopt\).*\n/m, '').replace(/@<org>\/<repo-team>/g, repoOwner);
  actions.push({ path: '.github/CODEOWNERS', action: 'create', after: full });
  manifest[`.github/CODEOWNERS${CODEOWNERS_KEY}`] = hash(co.block);
}

const manifestText = `${JSON.stringify({ standardVersion: version(), stack: selection, files: Object.fromEntries(Object.entries(manifest).sort()) }, null, 2)}\n`;
actions.push({ path: '.claude/std/manifest.json', action: 'create', after: manifestText });
const proposals = actions.filter((a) => a.action === 'propose');
if (proposals.length) {
  const lines = ['# Team AI standard: adoption checklist', '', 'These files could not be merged automatically. Merge each `.proposed` file into your file, delete it, then delete this checklist.', ''];
  for (const p of proposals) lines.push(`- [ ] \`${p.original}\`: ${p.note}; compare with \`${p.path}\`.`);
  lines.push('- [ ] Run `node .claude/std/compose-settings.mjs --check`.', '');
  actions.push({ path: '.claude/std-adoption-checklist.md', action: 'create', after: lines.join('\n') });
}
actions.sort((a, b) => a.path.localeCompare(b.path));

const writes = actions.filter((a) => a.action !== 'same');
const modifies = writes.some((a) => a.action === 'modify');
const open = decisions.filter((d) => !(PROPOSE && d.proposable));
const flags = args.filter((a, i) => !['--dry-run', '--yes', '--plan'].includes(a) && args[i - 1] !== '--plan');
const planHash = hash(JSON.stringify({
  version: version(), target: TARGET, flags,
  actions: writes.map((a) => [a.path, a.action, a.before === undefined ? null : hash(a.before), hash(a.after)]),
  decisions: open.map((d) => `${d.file}: ${d.what}`)
})).slice(0, 16);

// --- report ---------------------------------------------------------------------------
console.log(`Team AI standard ${version()} — profile ${profile}${DRY ? ' — DRY RUN, nothing is written' : ''}`);
console.log(`Stack: ${describe(selection)} (${summary(selection)})`);
for (const d of DIMENSIONS) {
  const v = Array.isArray(selection[d]) ? (selection[d].join(', ') || '(none)') : selection[d];
  console.log(`  ${d.padEnd(11)} ${String(v).padEnd(18)} ${source[d]}`);
}
if (DIMENSIONS.some((d) => source[d] === 'detected')) for (const n of detected.notes) console.log(`  note: ${n}`);
for (const w of warnings) console.log(`warning: ${w}`);
if (acknowledgedUnsupported.length) console.log(`note: no fragment exists for ${acknowledgedUnsupported.join(', ')}; your explicit choice will be recorded in .claude/project.json as acknowledgedUnsupported.`);

console.log('\nPlan:');
for (const a of writes) console.log(`  ${a.action.padEnd(7)}  ${a.path}${a.note ? `  (${a.note})` : ''}`);
const unchanged = actions.length - writes.length;
if (unchanged) console.log(`  (${unchanged} standard file(s) already identical)`);
for (const a of writes.filter((x) => x.action === 'modify' || x.showDiff)) console.log(`\n${unifiedDiff(a.before === undefined ? null : a.before, a.after, a.path)}`.trimEnd());
if (merge) {
  console.log('\nPermission rules from your .claude/settings.json:');
  if (!merge.carried.length && !merge.dropped.length && !merge.replaced.length) console.log('  nothing to carry over');
  for (const r of merge.carried) console.log(`  carried  ${r.list.padEnd(5)} ${r.rule}  → .claude/project.json: ${r.reason}`);
  for (const r of merge.dropped) console.log(`  dropped  ${r.list.padEnd(5)} ${r.rule}  (${r.reason})`);
  for (const r of merge.replaced) console.log(`  replaced ${r}`);
}
console.log('\nCommands found in package.json:');
for (const [key, value] of Object.entries(commands)) console.log(`  ${key.padEnd(19)} ${value || 'TODO (not found)'}${matched[key] ? `  ← "${matched[key]}"` : ''}`);
if (suggestions.length) {
  console.log('\nOptional cleanup (never done automatically):');
  for (const s of suggestions) console.log(`  - ${s}`);
}
if (open.length) {
  console.log('\nDecisions required (--yes refuses until they are resolved):');
  for (const d of open) console.log(`  - ${d.file} ${d.what}: ${d.resolve}`);
}
const git = modifies ? gitProblems(TARGET) : [];
if (git.length) {
  console.log('\nBefore --yes (existing files will be modified):');
  for (const g of git) console.log(`  - ${g.what}. Fix:\n${g.fix.map((c) => `      ${c}`).join('\n')}`);
}
console.log(`\nPlan hash: ${planHash}`);

// --- dry run: record the plan ------------------------------------------------------------
const recordDir = join(tmpdir(), `team-ai-standard-adopt-${process.getuid ? process.getuid() : 'user'}`);
const recordFile = join(recordDir, `${hash(TARGET).slice(0, 16)}.plan`);
if (DRY) {
  mkdirSync(recordDir, { recursive: true, mode: 0o700 });
  writeFileSync(recordFile, `${planHash}\n`, { mode: 0o600 });
  console.log(open.length ? `\nDry run: no files were written. Resolve the decisions above, then run --dry-run again.` : `\nDry run: no files were written. To apply exactly this plan, run the same command with --yes instead of --dry-run.`);
  process.exit(0);
}

// --- apply ------------------------------------------------------------------------------
if (open.length) die(3, `${open.length} decision(s) required; nothing was written. See "Decisions required" above.`);
const expected = opt('plan') || (existsSync(recordFile) ? readFileSync(recordFile, 'utf8').trim() : null);
if (!expected) die(3, 'no reviewed plan for this repository; nothing was written. Run the same command with --dry-run first, then --yes.');
if (expected !== planHash) die(3, `the plan changed since it was reviewed (reviewed ${expected}, now ${planHash}): a file, a flag or the standard changed. Nothing was written. Run --dry-run again and review the new plan.`);
if (git.length) die(3, 'existing files would be modified, but git is not in a safe state; nothing was written. Run the commands under "Before --yes" above.');

for (const a of writes) {
  mkdirSync(dirname(join(TARGET, a.path)), { recursive: true });
  writeFileSync(join(TARGET, a.path), a.after);
}
rmSync(recordFile, { force: true });
const verify = spawnSync('node', [join(TARGET, '.claude/std/compose-settings.mjs'), '--root', TARGET, '--check'], { encoding: 'utf8' });
if (verify.status !== 0 && !proposals.length) die(1, `written, but the consistency check failed:\n${verify.stderr}`);
if (verify.status !== 0) console.log('\nnote: std-check passes once the proposed file(s) are merged.');

const claudeNow = read('CLAUDE.md');
const todos = (claudeNow.match(/TODO\(adopt\)/g) || []).length;
const missing = Object.entries(commands).filter(([, v]) => !v).map(([k]) => k);
const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const steps = [];
if (todos) steps.push(`Fill in ${todos} TODO(adopt) item(s) in CLAUDE.md (about 20 minutes).`);
if (missing.length) steps.push(`Set these commands in .claude/project.json, or leave them null if the repository has none: ${missing.join(', ')}. Then run: node .claude/std/compose-settings.mjs`);
if (proposals.length) steps.push('Merge the proposed file(s): see .claude/std-adoption-checklist.md');
if (!/settings\.local\.json/.test(gitignore)) steps.push('Add .claude/settings.local.json to .gitignore.');
steps.push('Review with git diff; to undo everything: git restore . && git clean -fd (check first with git clean -nd).');
steps.push('Commit, open a PR, and ask the owner of the standard to add this repository to .github/standard-targets.json.');
console.log(`\nApplied plan ${planHash}: ${writes.length} file(s) written. Next steps:`);
steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
