#!/usr/bin/env node
// Updates one adopted project repository to the current version of the team
// standard. Used by .github/workflows/standard-update.yml; can also be run by
// hand. It never commits or pushes.
//
//   node scripts/sync-standard.mjs --target <dir> [--summary <file>] [--allow-unreleased]
//
// Run by hand, it refuses a standard checkout that is not a clean release (HEAD on
// tag v<version>), unless --allow-unreleased is passed; the summary then says so.
// In GitHub Actions the check is skipped: standard-update.yml already checks that
// the tag matches the version.
//
// Writes ONLY Layer 1 (STANDARD) files:
//   .claude/rules/std/**, .claude/agents/std-*, .claude/skills/std-*/**, .claude/std/**,
//   .claude/STANDARD_VERSION, .github/workflows/std-check.yml, optional groups
//   listed in the manifest, the PR template and the CODEOWNERS block (only
//   where the managed marker or std block is present), .claude/settings.json
//   (regenerated from the new base profile and the repository's project.json),
//   and the inside of the std blocks in CLAUDE.md.
// Never touches the rest of CLAUDE.md, .claude/project.json, .claude/rules/local/**
// (Layer 2) or .claude/settings.local.json (Layer 3). The stack selection and profile are
// read from the repository's .claude/project.json; fragments that are no longer
// selected are removed (they are Layer 1 files listed in the manifest).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { standardRelease } from './lib/git.mjs';
import {
  CODEOWNERS_KEY, CODEOWNERS_LOCATIONS, MANAGED_MARKER, OPTIONAL, PR_BLOCK_RE, PR_KEY, codeownersPlaceholders,
  ROOT, codeownersBlock, coreFiles, findBlock, hash, keptOptional, normalize, optionalFiles, prBlock, prTemplate, summary, unsupportedIn,
  validate, version, workflowEnvironments, ENVIRONMENT_NOTE
} from './lib/standard.mjs';
import { BLOCK_NAMES, hasBlock } from '../templates/.claude/std/compose.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const target = arg('target');
const summaryFile = arg('summary');
if (!target) {
  console.error('usage: sync-standard.mjs --target <dir> [--summary <file>] [--allow-unreleased]');
  process.exit(2);
}
const exists = (p) => existsSync(join(target, p));
const read = (p) => readFileSync(join(target, p), 'utf8');
const write = (p, text) => {
  mkdirSync(dirname(join(target, p)), { recursive: true });
  writeFileSync(join(target, p), text);
};

if (!exists('.claude/project.json')) {
  console.error(`sync: ${target} has not adopted the standard (.claude/project.json missing). Run scripts/adopt.mjs there first.`);
  process.exit(1);
}
const placeholders = codeownersPlaceholders();
if (placeholders.length) {
  console.error(`sync: templates/.github/CODEOWNERS still has placeholder owners (${placeholders.join(', ')}). Set the real team before updating repositories.`);
  process.exit(2);
}
const release = process.env.GITHUB_ACTIONS === 'true' ? { problems: [] } : standardRelease(resolve(ROOT));
if (release.problems.length && !process.argv.includes('--allow-unreleased')) {
  console.error(`sync: the standard checkout at ${resolve(ROOT)} is not a released version (${release.state}); nothing was written.`);
  for (const p of release.problems) console.error(`  - ${p.what}. Fix:\n${p.fix.map((c) => `      ${c}`).join('\n')}`);
  console.error('Maintainers testing unreleased changes: --allow-unreleased.');
  process.exit(3);
}
const project = JSON.parse(read('.claude/project.json'));
let selection;
try {
  selection = normalize(project.stack);
} catch (err) {
  console.error(`sync: .claude/project.json: ${err.message}`);
  process.exit(1);
}
const { errors } = validate(selection);
if (errors.length) {
  console.error(`sync: .claude/project.json has an invalid stack selection:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
const previous = exists('.claude/STANDARD_VERSION') ? read('.claude/STANDARD_VERSION').trim() : '(none)';
const oldManifest = exists('.claude/std/manifest.json') ? JSON.parse(read('.claude/std/manifest.json')) : { files: {} };
const oldFiles = Object.keys(oldManifest.files || {});

const updated = [];
const removed = [];
const notManaged = [];
const manifest = {};

// 1. Core files for the repository's stack, plus the optional groups it chose
//    (project.json "optionalGroups"; repositories adopted earlier: what the manifest lists)
// Optional fragments that were common rules before: kept until project.json records a choice.
const kept = keptOptional(oldFiles, selection);
const wanted = coreFiles(kept.length ? normalize({ ...selection, optional: [...selection.optional, ...kept] }) : selection);
const recordWith = (names) => [...selection.optional, ...names].join(',');
for (const name of kept) {
  notManaged.push(`\`${name}\` is now an optional fragment (it was a common rule) and was kept for this repository. Record the choice: \`adopt.mjs --with ${recordWith([name])} --dry-run\` keeps it, ${selection.optional.length ? `\`--with ${recordWith([])}\`` : '`--without-optional`'} removes it.`);
}
for (const [group, entries] of Object.entries(OPTIONAL)) {
  const chosen = Array.isArray(project.optionalGroups) ? project.optionalGroups.includes(group) : entries.some(([, dest]) => oldFiles.includes(dest));
  if (chosen) wanted.push(...optionalFiles(group));
}
const wantedPaths = new Set(wanted.map((f) => f.path));
for (const f of wanted) {
  if (f.path === '.claude/std/manifest.json') continue;
  if (!exists(f.path) || read(f.path) !== f.content) {
    write(f.path, f.content);
    updated.push(f.path);
  }
  manifest[f.path] = hash(f.content);
}

// 2. Standard files removed upstream (only files the manifest says we own)
for (const path of oldFiles) {
  if (path.includes('#') || path === '.claude/settings.json' || path === '.github/pull_request_template.md') continue;
  if (!wantedPaths.has(path) && exists(path)) {
    rmSync(join(target, path));
    removed.push(path);
  }
}

// 3. PR template: the std block appended to the repository's template, or the
//    whole file when it is the standard's (managed marker). Block first: an
//    appended block also contains the marker.
const pr = prTemplate();
const prText = exists('.github/pull_request_template.md') ? read('.github/pull_request_template.md') : null;
if (prText !== null && PR_BLOCK_RE.test(prText)) {
  const next = prText.replace(PR_BLOCK_RE, () => prBlock().text);
  if (next !== prText) {
    write('.github/pull_request_template.md', next);
    updated.push('.github/pull_request_template.md (standard block only)');
  }
  manifest[PR_KEY] = hash(prBlock().inner);
} else if (prText !== null) {
  if (prText.includes(MANAGED_MARKER)) {
    if (read('.github/pull_request_template.md') !== pr) {
      write('.github/pull_request_template.md', pr);
      updated.push('.github/pull_request_template.md');
    }
    manifest['.github/pull_request_template.md'] = hash(pr);
  } else {
    notManaged.push('`.github/pull_request_template.md` has no managed marker or standard block; not updated.');
  }
} else {
  write('.github/pull_request_template.md', pr);
  updated.push('.github/pull_request_template.md');
  manifest['.github/pull_request_template.md'] = hash(pr);
}

// 4. CODEOWNERS: only the block between the markers, with the project owner from project.json
const block = codeownersBlock(project.repoOwner);
const coPath = CODEOWNERS_LOCATIONS.find(exists);
if (coPath) {
  const text = read(coPath);
  const found = findBlock(text);
  if (found) {
    const next = text.slice(0, found.start) + block + text.slice(found.end);
    if (next !== text) {
      write(coPath, next);
      updated.push(`${coPath} (standard block only)`);
    }
    manifest[`${coPath}${CODEOWNERS_KEY}`] = hash(block);
  } else {
    notManaged.push(`\`${coPath}\` has no team-ai-standard block; not updated.`);
  }
} else {
  notManaged.push('No CODEOWNERS file; the standard block was not added (CODEOWNERS also holds project owners).');
}

// 5. settings.json from the new base and project.json, and the std blocks in
//    CLAUDE.md (only the text inside them; the rest stays byte for byte)
const settingsBefore = exists('.claude/settings.json') ? read('.claude/settings.json') : '{}';
const claudeBefore = exists('CLAUDE.md') ? read('CLAUDE.md') : null;
execFileSync('node', [join(target, '.claude/std/compose-settings.mjs'), '--root', target], { stdio: ['ignore', 'ignore', 'inherit'] });
const settingsAfter = read('.claude/settings.json');
if (settingsAfter !== settingsBefore) updated.push('.claude/settings.json (regenerated)');
manifest['.claude/settings.json'] = hash(settingsAfter);
if (claudeBefore === null) notManaged.push('No `CLAUDE.md`; the std blocks were not added.');
else {
  if (read('CLAUDE.md') !== claudeBefore) updated.push('`CLAUDE.md` (std blocks only)');
  const missingBlocks = BLOCK_NAMES.filter((name) => !hasBlock(claudeBefore, name));
  if (missingBlocks.length) notManaged.push(`\`CLAUDE.md\` has no std block(s) ${missingBlocks.join(', ')}; not added. Text outside std blocks belongs to the repository.`);
}
const rules = (text) => {
  try {
    const p = JSON.parse(text).permissions || {};
    return new Set(['allow', 'ask', 'deny'].flatMap((k) => (p[k] || []).map((r) => `${k}: \`${r}\``)));
  } catch {
    return new Set();
  }
};
const before = rules(settingsBefore);
const after = rules(settingsAfter);
const addedRules = [...after].filter((r) => !before.has(r));
const removedRules = [...before].filter((r) => !after.has(r));

// Dependencies without a fragment that the repository has not acknowledged
const acknowledged = new Set(project.acknowledgedUnsupported || []);
for (const u of unsupportedIn(target)) {
  if (!acknowledged.has(u.dep)) {
    notManaged.push(`\`${u.dep}\` has no ${u.dimension === 'dataAccess' ? 'data-access' : u.dimension} fragment in the standard and is not acknowledged. Add a fragment (docs/en/11-adding-a-stack-fragment.md), or if the stack selection is right, add it to \`acknowledgedUnsupported\` in \`.claude/project.json\`.`);
  }
}

// Workflows that run in GitHub environments: the update cannot check the plan or settings.
const environments = workflowEnvironments(wanted);
if (environments.length) {
  notManaged.push(`Workflows reference GitHub environments: ${environments.map((e) => `\`${e.name}\` (\`${e.path}\`)`).join(', ')}. Check they exist before merging. ${ENVIRONMENT_NOTE}`);
}

// 6. Version and manifest
write('.claude/std/manifest.json', `${JSON.stringify({ standardVersion: version(), stack: selection, files: Object.fromEntries(Object.entries(manifest).sort()) }, null, 2)}\n`);

const list = (items) => (items.length ? items.map((i) => `- ${i.startsWith('`') || i.includes(' ') ? i : `\`${i}\``}`) : ['- none']);
const out = [
  `## Team AI standard ${previous} → ${version()}`,
  '',
  ...(release.problems.length ? [`> **Unreleased standard checkout** (\`--allow-unreleased\`, ${release.state}): ${release.problems.map((p) => p.what).join('; ')}. Do not merge as a release update.`, ''] : []),
  `Stack **${summary(selection)}**, profile **${project.profile}** (from \`.claude/project.json\`). Read the standard's CHANGELOG for this release before merging.`,
  '',
  'Only standard files (Layer 1) and the inside of the std blocks in `CLAUDE.md` are changed. The rest of `CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/` and personal settings are not touched.',
  '',
  '### Files updated',
  '',
  ...list(updated),
  '',
  '### Standard files removed upstream',
  '',
  ...list(removed),
  '',
  '### Permission rule changes in `.claude/settings.json`',
  '',
  ...(addedRules.length || removedRules.length ? [...addedRules.map((r) => `- added ${r}`), ...removedRules.map((r) => `- removed ${r}`)] : ['- none']),
  '',
  '### Review by hand',
  '',
  ...(notManaged.length ? notManaged.map((n) => `- ${n}`) : ['- nothing']),
  ''
].join('\n');

if (summaryFile) writeFileSync(summaryFile, out);
console.log(out);
