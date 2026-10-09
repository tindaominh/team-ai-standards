#!/usr/bin/env node
// Adopts the team AI standard in a project repository, or changes its stored
// configuration later. Run from the project repository:
//   node <path-to-standard>/scripts/adopt.mjs [options] --dry-run   review everything
//   node <path-to-standard>/scripts/adopt.mjs [options] --yes       apply exactly that
// Options: scripts/lib/adopt-options.mjs (also `--help` and the README tables).
//
// Guarantees:
// - Each configuration value comes from a flag, then .claude/project.json, then
//   detection, then the default; --dry-run shows the source of each. Configuration
//   is stored in .claude/project.json, so later runs and updates reuse it.
// - --dry-run prints every change (diffs of modified files) and a plan hash computed
//   from the standard version, the flags, the existing files and the result. --yes
//   recomputes it and stops if anything differs.
// - Project content is never deleted or rewritten: CLAUDE.md gets std blocks, the PR
//   template and CODEOWNERS get an appended block, settings.json is regenerated with
//   the repository's own stricter rules moved into .claude/project.json.
// - Permissions are never loosened automatically.
// - Files are written only on a clean git working tree, off the default branch. They are
//   staged first and moved into place; on any error every change is rolled back and the
//   reviewed plan is kept.
// - The plan hash takes the flags in a fixed order, so typing them in another order gives
//   the same plan. A JSON file that cannot be parsed stops adoption with its path (exit 2).
// - --yes runs only from a released standard checkout (clean, HEAD on tag v<version>),
//   unless --allow-unreleased is passed, which is printed in the output.
// - Decisions that need a human stop --yes. *.proposed files exist only for the
//   --propose-unresolved fallback. No commits, pushes, installs or network.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { canonicalFlags, helpText, parseArgs } from './lib/adopt-options.mjs';
import { buildPlan } from './lib/adopt-plan.mjs';
import { applyWrites } from './lib/apply-writes.mjs';
import { unifiedDiff } from './lib/diff.mjs';
import { formatChain } from './lib/script-chain.mjs';
import { gitProblems, standardRelease } from './lib/git.mjs';
import {
  COMMAND_CANDIDATES, DIMENSIONS, FLAG_FOR, ROOT, T, codeownersPlaceholders, describe, detect, expandAlias, hash,
  ENVIRONMENT_NOTE, isUnfilledClaude, keptOptional, normalize, registry, summary, validate, version, workflowEnvironments
} from './lib/standard.mjs';

const argv = process.argv.slice(2);
const { opts, errors: argErrors } = parseArgs(argv);
const die = (code, msg) => {
  console.error(`adopt: ${msg}`);
  process.exit(code);
};
if (opts.help) {
  console.log(helpText());
  process.exit(0);
}
if (argErrors.length) die(2, argErrors.join('\n  '));
const DRY = Boolean(opts['dry-run']);
const YES = Boolean(opts.yes);
const TARGET = resolve(opts.target || process.cwd());
const allowChoices = { carry: opts['carry-allow'] || [], drop: opts['drop-allow'] || [], dropRest: Boolean(opts['drop-allow-rest']) };
const bothWays = allowChoices.carry.filter((r) => allowChoices.drop.includes(r));
if (bothWays.length) die(2, `a rule cannot be both carried and dropped: ${bothWays.join(', ')}`);

const placeholders = codeownersPlaceholders();
if (placeholders.length) {
  die(2, `the standard is not ready for adoption: templates/.github/CODEOWNERS still has placeholder owners in the team-ai-standard block (${placeholders.join(', ')}). The owner of the standard must replace them with the real GitHub team (for example @<org>/ai-standard-owners) first.`);
}
const exists = (p) => existsSync(join(TARGET, p));
const read = (p) => readFileSync(join(TARGET, p), 'utf8');
const readJson = (file, shown, fix = 'fix it first.') => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return die(2, `${shown} cannot be parsed (${err.message}); ${fix}`);
  }
};

// --- the standard checkout this runs from must be a clean release ----------------------------
const STD_ROOT = resolve(ROOT);
const release = standardRelease(STD_ROOT);
const UNRELEASED = Boolean(opts['allow-unreleased']);
const releaseFixes = () => release.problems.map((p) => `  - ${p.what}. Fix:\n${p.fix.map((c) => `      ${c}`).join('\n')}`).join('\n');
if (YES && release.problems.length && !UNRELEASED) {
  die(3, `the standard checkout at ${STD_ROOT} is not a released version (${release.state}); nothing was written.\n${releaseFixes()}\nThen run --dry-run again. Maintainers testing unreleased changes: --allow-unreleased (on both --dry-run and --yes).`);
}

// --- a previous adoption: its stored configuration is the starting point -------------------
let previous = null;
if (exists('.claude/project.json')) {
  previous = readJson(join(TARGET, '.claude/project.json'), '.claude/project.json');
  const installed = exists('.claude/STANDARD_VERSION') ? read('.claude/STANDARD_VERSION').trim() : 'unknown';
  if (installed !== version()) {
    die(3, `this repository uses version ${installed} of the standard and this is ${version()}. Update it first (the update pull request, or scripts/sync-standard.mjs --target <dir>); adopt then changes its configuration.`);
  }
}

// --- values and where they come from: flag > project.json > detected > default ------------
const sources = {};
function pick(name, flag, stored, fallback, fallbackSource = 'default') {
  if (flag !== undefined) { sources[name] = 'flag'; return flag; }
  if (stored !== undefined) { sources[name] = 'project.json'; return stored; }
  sources[name] = fallbackSource;
  return fallback;
}
const profile = pick('profile', opts.profile, previous?.profile, 'strict');
if (!['strict', 'standard'].includes(profile)) die(2, '--profile must be strict (client repositories, default) or standard (internal repositories only).');
// Parsed here so a broken file stops with its path; the libraries read them again.
const profileSettings = join(T, `.claude/std/settings.${profile}.json`);
readJson(profileSettings, profileSettings, 'the standard checkout is damaged: check out its release tag again.');
const manifestFiles = previous && exists('.claude/std/manifest.json')
  ? Object.keys(readJson(join(TARGET, '.claude/std/manifest.json'), '.claude/std/manifest.json').files || {})
  : null;
const pkgJson = exists('package.json') ? readJson(join(TARGET, 'package.json'), 'package.json') : null;
const repoOwner = pick('repo-owner', opts['repo-owner'], previous?.repoOwner ?? undefined, null);
if (repoOwner !== null && !/^@[A-Za-z0-9-]+(\/[A-Za-z0-9._-]+)?$/.test(repoOwner)) die(2, `--repo-owner must be @user or @org/team (got ${JSON.stringify(repoOwner)}).`);
const manifestDocs = Boolean(manifestFiles && manifestFiles.includes('scripts/generate-docs.mjs'));
const withDocs = pick('with-docs', opts['with-docs'], previous ? (previous.optionalGroups ? previous.optionalGroups.includes('docs') : manifestDocs) : undefined, false);

const detected = detect(TARGET);
let selection = previous ? normalize(previous.stack) : detected.selection;
for (const d of DIMENSIONS) sources[d] = previous ? 'project.json' : 'detected';
if (opts.stack) {
  try {
    selection = expandAlias(opts.stack);
  } catch (err) {
    die(2, err.message);
  }
  for (const d of DIMENSIONS) sources[d] = `flag (--stack ${opts.stack})`;
}
if (opts.framework) { selection.framework = opts.framework; sources.framework = 'flag'; }
if (opts.db) { selection.databases = opts.db; sources.databases = 'flag'; }
if (opts['data-access']) { selection.dataAccess = opts['data-access']; sources.dataAccess = 'flag'; }
if (opts.with) { selection.optional = opts.with; sources.optional = 'flag'; }
if (opts['without-optional']) { selection.optional = []; sources.optional = 'flag'; }
selection = normalize(selection);
// Optional fragments that were common rules before 0.8.0: a re-run records them unless a flag decides.
if (previous && sources.optional === 'project.json' && manifestFiles) {
  const kept = keptOptional(manifestFiles, selection);
  if (kept.length) {
    selection = normalize({ ...selection, optional: [...selection.optional, ...kept] });
    sources.optional = `project.json + ${kept.join(', ')} (installed before it became optional)`;
  }
}

const reg = registry().dimensions;
const options = () => DIMENSIONS.map((d) => `  ${d.padEnd(11)} ${Object.keys(reg[d].values).join(' | ')}`).join('\n');
const unresolved = detected.ambiguous.filter((a) => sources[a.dimension] === 'detected');
if (unresolved.length) {
  console.error('adopt: stack detection is ambiguous; nothing was written.\nDecisions required:');
  for (const a of unresolved) console.error(`  ${a.dimension}: found ${a.options.join(' and ')} — choose with ${a.hint}`);
  console.error(`\nOptions:\n${options()}\nAliases: ${Object.keys(registry().aliases).join(', ')}`);
  process.exit(3);
}
const stopping = detected.unsupported.filter((u) => sources[u.dimension] === 'detected');
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
// Acknowledged: what was acknowledged before, plus dependencies overridden by a flag now
const acknowledgedUnsupported = [...new Set([
  ...(previous ? previous.acknowledgedUnsupported || [] : []),
  ...detected.unsupported.filter((u) => !previous || sources[u.dimension].startsWith('flag')).map((u) => u.dep)
])].sort();
const { errors, warnings } = validate(selection);
if (errors.length) die(2, `invalid stack selection:\n  ${errors.join('\n  ')}\n\nOptions:\n${options()}`);

const flagsFor = (sel) => [`--framework ${sel.framework}`, ...(sel.databases.length ? [`--db ${sel.databases.join(',')}`] : []), `--data-access ${sel.dataAccess}`, sel.optional.length ? `--with ${sel.optional.join(',')}` : '--without-optional'].join(' ');
if (!DRY && !YES) {
  console.error('adopt: nothing was written. Review the plan with --dry-run, then apply it with --yes:');
  console.error(`  node <path-to-standard>/scripts/adopt.mjs --profile ${profile} ${flagsFor(selection)} --dry-run`);
  console.error(`  node <path-to-standard>/scripts/adopt.mjs --profile ${profile} ${flagsFor(selection)} --yes`);
  process.exit(3);
}

// --- commands: found in package.json on first adoption; on a later run the stored ones,
// with only those still null filled from package.json (a set command is never replaced) --------
function commandsFromPackage() {
  const pkg = pkgJson;
  const scripts = (pkg && pkg.scripts) || {};
  const manager = exists('pnpm-lock.yaml') ? 'pnpm' : exists('yarn.lock') ? 'yarn' : 'npm';
  const runScript = (name) => (manager === 'npm' ? (name === 'test' ? 'npm test' : `npm run ${name}`) : `${manager} ${name}`);
  const installCmd = { npm: exists('package-lock.json') ? 'npm ci' : 'npm install', pnpm: 'pnpm install --frozen-lockfile', yarn: 'yarn install --frozen-lockfile' }[manager];
  const found = { install: pkg ? installCmd : null };
  const names = {};
  for (const [key, candidates] of Object.entries(COMMAND_CANDIDATES)) {
    const name = candidates.find((c) => c in scripts);
    found[key] = name ? runScript(name) : null;
    if (name) names[key] = name;
  }
  if (pkg) names.install = 'lockfile';
  return { found, names };
}
const fromPackage = commandsFromPackage();
const matched = {};
let commands;
if (!previous?.commands) {
  commands = fromPackage.found;
  for (const [key, name] of Object.entries(fromPackage.names)) if (key !== 'install') matched[key] = name;
} else {
  commands = { ...previous.commands };
  for (const [key, value] of Object.entries(fromPackage.found)) {
    if ((commands[key] === null || commands[key] === undefined) && value) {
      commands[key] = value;
      matched[key] = fromPackage.names[key];
    }
  }
}

// --- plan ---------------------------------------------------------------------------------
const PROPOSE = Boolean(opts['propose-unresolved']);
const { actions, decisions, suggestions, merge, proposals } = buildPlan({
  target: TARGET, selection, profile, repoOwner, withDocs, commands, acknowledgedUnsupported, allowChoices, propose: PROPOSE, previous
});
const writes = actions.filter((a) => a.action !== 'same');
const open = decisions.filter((d) => !(PROPOSE && d.proposable));
const flags = canonicalFlags(opts);
const planHash = hash(JSON.stringify({
  version: version(), target: TARGET, flags,
  actions: writes.map((a) => [a.path, a.action, a.before === undefined ? null : hash(a.before), a.after === undefined ? null : hash(a.after)]),
  decisions: open.map((d) => `${d.file}: ${d.what}`)
})).slice(0, 16);

// --- report -------------------------------------------------------------------------------
console.log(`Team AI standard ${version()} — profile ${profile}${DRY ? ' — DRY RUN, nothing is written' : ''}`);
console.log(`Standard checkout: ${release.state} (${STD_ROOT})`);
if (release.problems.length && UNRELEASED) {
  console.log(`UNRELEASED STANDARD (--allow-unreleased): this checkout is not a clean release; for maintainers testing changes only.\n${release.problems.map((p) => `  - ${p.what}`).join('\n')}`);
} else if (release.problems.length) {
  console.log(`warning: the standard checkout is not a released version; --yes will refuse.\n${releaseFixes()}`);
}
console.log(`Stack: ${describe(selection)} (${summary(selection)})`);
console.log('Values (source: flag, project.json, detected or default):');
const shown = (v) => (Array.isArray(v) ? (v.join(', ') || '(none)') : v === null ? '(none)' : String(v));
const valueRows = [['profile', profile], ...DIMENSIONS.map((d) => [d, selection[d]]), ['repo-owner', repoOwner], ['with-docs', withDocs ? 'on' : 'off']];
for (const [name, v] of valueRows) console.log(`  ${name.padEnd(11)} ${shown(v).padEnd(18)} ${sources[name]}`);
if (DIMENSIONS.some((d) => sources[d] === 'detected')) for (const n of detected.notes) console.log(`  note: ${n}`);
for (const w of warnings) console.log(`warning: ${w}`);
if (acknowledgedUnsupported.length) console.log(`note: no fragment exists for ${acknowledgedUnsupported.join(', ')}; recorded in .claude/project.json as acknowledgedUnsupported.`);

if (!writes.length && !open.length) {
  console.log('\nNothing to do: the repository already matches these values and this version of the standard.');
  process.exit(0);
}
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
  if (merge.allowReport.length) {
    console.log('\nExisting allow rules (.claude/settings.json):');
    const label = { covered: 'covered', unsafe: 'unsafe — cannot be carried', carried: 'carried', dropped: 'dropped', 'needs-decision': 'needs decision' };
    const width = Math.max(...merge.allowReport.map((r) => label[r.status].length));
    for (const r of merge.allowReport) {
      const flagged = `profile ${r.list === 'deny' ? 'denies' : 'asks'} ${r.by}`;
      const why = r.status === 'covered' ? `  (by ${r.by})` : r.status === 'unsafe' ? `  (${r.chain ? `${formatChain(r.chain)} (${flagged})` : flagged})` : r.hint ? `  — ${r.hint}` : '';
      console.log(`  ${label[r.status].padEnd(width)}  ${r.rule}${why}`);
    }
  }
}
if (previous && (allowChoices.carry.length || allowChoices.drop.length || allowChoices.dropRest)) {
  console.log('\nnote: --carry-allow, --drop-allow and --drop-allow-rest apply to the first adoption only; change allow rules in .claude/project.json → permissions.allow.');
}
if (!previous) {
  console.log('\nCommands found in package.json:');
  for (const [key, value] of Object.entries(commands)) console.log(`  ${key.padEnd(19)} ${value || 'TODO (not found)'}${matched[key] ? `  ← "${matched[key]}"` : ''}`);
} else if (Object.keys(matched).length) {
  console.log('\nCommands filled from package.json (they were not set in .claude/project.json; set commands are never replaced):');
  for (const [key, name] of Object.entries(matched)) console.log(`  ${key.padEnd(19)} ${commands[key]}  ← ${name === 'lockfile' ? 'lockfile' : `"${name}"`}`);
}
// Workflows that read secrets run in GitHub environments; adopt cannot check the plan or settings.
const environments = workflowEnvironments(actions.map((x) => ({ path: x.path, content: x.after })));
const environmentLines = () => [...environments.map((e) => `  ${e.name.padEnd(16)} ${e.path}`), `  ${ENVIRONMENT_NOTE}`];
if (environments.length) console.log(`\nGitHub environments (not checked: adopt cannot see your GitHub plan or settings):\n${environmentLines().join('\n')}`);
if (suggestions.length) {
  console.log('\nOptional cleanup (never done automatically):');
  for (const s of suggestions) console.log(`  - ${s}`);
}
if (open.length) {
  console.log('\nDecisions required (--yes refuses until they are resolved):');
  for (const d of open) console.log(`  - ${d.file} ${d.what}: ${d.resolve}`);
}
const git = writes.length ? gitProblems(TARGET) : [];
if (git.length) {
  console.log('\nBefore --yes (files will be written):');
  for (const g of git) console.log(`  - ${g.what}. Fix:\n${g.fix.map((c) => `      ${c}`).join('\n')}`);
}
console.log(`\nPlan hash: ${planHash}`);

// --- dry run: record the plan ----------------------------------------------------------------
const recordDir = join(tmpdir(), `team-ai-standard-adopt-${process.getuid ? process.getuid() : 'user'}`);
const recordFile = join(recordDir, `${hash(TARGET).slice(0, 16)}.plan`);
if (DRY) {
  mkdirSync(recordDir, { recursive: true, mode: 0o700 });
  writeFileSync(recordFile, `${planHash}\n`, { mode: 0o600 });
  console.log(open.length ? '\nDry run: no files were written. Resolve the decisions above, then run --dry-run again.' : '\nDry run: no files were written. To apply exactly this plan, run the same command with --yes instead of --dry-run.');
  process.exit(0);
}

// --- apply ----------------------------------------------------------------------------------
if (open.length) die(3, `${open.length} decision(s) required; nothing was written. See "Decisions required" above.`);
const expected = opts.plan || (existsSync(recordFile) ? readFileSync(recordFile, 'utf8').trim() : null);
if (!expected) die(3, 'no reviewed plan for this repository; nothing was written. Run the same command with --dry-run first, then --yes.');
if (expected !== planHash) die(3, `the plan changed since it was reviewed (reviewed ${expected}, now ${planHash}): a file, a flag or the standard changed. Nothing was written. Run --dry-run again and review the new plan.`);
if (git.length) die(3, 'existing files would be modified, but git is not in a safe state; nothing was written. Run the commands under "Before --yes" above.');

const applied = applyWrites(TARGET, writes);
if (!applied.ok) {
  const cause = `writing ${applied.failedPath} failed (${applied.error.message})`;
  if (!applied.restoreFailures.length) {
    die(1, `${cause}; rolled back every change: no file is half-written and the repository is as before. The reviewed plan is kept: fix the cause and run --yes again.`);
  }
  die(1, `${cause}, and these files could not be restored:\n${applied.restoreFailures.map((f) => `  - ${f.path}${f.backup ? ` (original: ${f.backup})` : ''}`).join('\n')}\nRestore them from the originals listed, or with git restore and git clean (check first with git clean -nd). The reviewed plan is kept.`);
}
rmSync(recordFile, { force: true });
const verify = spawnSync('node', [join(TARGET, '.claude/std/compose-settings.mjs'), '--root', TARGET, '--check'], { encoding: 'utf8' });
if (verify.status !== 0 && !proposals.length) die(1, `written, but the consistency check failed:\n${verify.stderr}`);
if (verify.status !== 0) console.log('\nnote: std-check passes once the proposed file(s) are merged.');

const claudeNow = exists('CLAUDE.md') ? read('CLAUDE.md') : '';
const todos = (claudeNow.match(/TODO\(adopt\)/g) || []).length;
const missing = Object.entries(commands).filter(([, v]) => !v).map(([k]) => k);
const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const steps = [];
if (claudeNow && isUnfilledClaude(claudeNow)) {
  // New, empty or freshly scaffolded repository: CLAUDE.md has no project content yet.
  // The guide and prompts stay in the standard checkout; they are linked, never copied.
  const at = (p) => join(STD_ROOT, p);
  steps.push(`New project: follow ${at('docs/en/12-new-project.md')} (Tiếng Việt: ${at('docs/vi/12-new-project.md')}).`);
  steps.push(`Fill in the ${todos} TODO(adopt) item(s) in CLAUDE.md with Claude Code, using the prompt ${at('templates/prompts/01-fill-claude-md.md')}.`);
  steps.push(`Optional: write docs/PROJECT_SPEC.md with ${at('templates/prompts/02-project-spec.md')}.`);
  steps.push(`Plan the first milestone with ${at('templates/prompts/03-kickoff-plan.md')} before any code.`);
} else if (todos) steps.push(`Fill in ${todos} TODO(adopt) item(s) in CLAUDE.md (about 20 minutes).`);
if (missing.length && !previous) steps.push(`Set these commands in .claude/project.json, or leave them null if the repository has none: ${missing.join(', ')}. Then run: node .claude/std/compose-settings.mjs`);
if (proposals.length) steps.push('Merge the proposed file(s): see .claude/std-adoption-checklist.md');
if (environments.length) steps.push(`Before these workflows run, configure their GitHub environments (${[...new Set(environments.map((e) => e.name))].join(', ')}). ${ENVIRONMENT_NOTE}`);
if (!/settings\.local\.json/.test(gitignore)) steps.push('Add .claude/settings.local.json to .gitignore.');
steps.push('Review with git diff; to undo everything: git restore . && git clean -fd (check first with git clean -nd).');
steps.push(previous ? 'Commit and open a PR.' : 'Commit, open a PR, and ask the owner of the standard to add this repository to .github/standard-targets.json.');
if (release.problems.length) console.log(`\nUNRELEASED STANDARD (--allow-unreleased): applied from ${release.state}, not a clean release.`);
console.log(`\nApplied plan ${planHash}: ${writes.length} file(s) written. Next steps:`);
steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
