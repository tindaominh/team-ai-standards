#!/usr/bin/env node
// Updates one adopted project repository to the current version of the team
// standard. Used by .github/workflows/standard-update.yml; can also be run by
// hand. It never commits or pushes.
//
//   node scripts/sync-standard.mjs --target <dir> [--summary <file>]
//
// Writes ONLY Layer 1 (STANDARD) files:
//   .claude/rules/std/**, .claude/agents/std-*, .claude/skills/std-*/**, .claude/std/**,
//   .claude/STANDARD_VERSION, .github/workflows/std-check.yml, optional groups
//   listed in the manifest, the PR template and the CODEOWNERS block (only
//   where the managed marker is present), and .claude/settings.json
//   (regenerated from the new base profile and the repository's project.json).
// Never touches Layer 2 (CLAUDE.md, .claude/project.json, .claude/rules/local/**)
// or Layer 3 (.claude/settings.local.json). The stack selection and profile are
// read from the repository's .claude/project.json; fragments that are no longer
// selected are removed (they are Layer 1 files listed in the manifest).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  CODEOWNERS_KEY, CODEOWNERS_LOCATIONS, MANAGED_MARKER, OPTIONAL, codeownersPlaceholders, codeownersTemplate,
  coreFiles, findBlock, hash, normalize, optionalFiles, prTemplate, summary, unsupportedIn, validate, version
} from './lib/standard.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const target = arg('target');
const summaryFile = arg('summary');
if (!target) {
  console.error('usage: sync-standard.mjs --target <dir> [--summary <file>]');
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

// 1. Core files for the repository's stack, plus optional groups it installed
const wanted = coreFiles(selection);
for (const [group, entries] of Object.entries(OPTIONAL)) {
  if (entries.some(([, dest]) => oldFiles.includes(dest))) wanted.push(...optionalFiles(group));
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

// 3. PR template: managed only when it carries the marker
const pr = prTemplate();
if (exists('.github/pull_request_template.md')) {
  if (read('.github/pull_request_template.md').includes(MANAGED_MARKER)) {
    if (read('.github/pull_request_template.md') !== pr) {
      write('.github/pull_request_template.md', pr);
      updated.push('.github/pull_request_template.md');
    }
    manifest['.github/pull_request_template.md'] = hash(pr);
  } else {
    notManaged.push('`.github/pull_request_template.md` has no managed marker (the adoption proposal was not merged); not updated.');
  }
} else {
  write('.github/pull_request_template.md', pr);
  updated.push('.github/pull_request_template.md');
  manifest['.github/pull_request_template.md'] = hash(pr);
}

// 4. CODEOWNERS: only the block between the markers
const block = codeownersTemplate().block;
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

// 5. settings.json from the new base and the repository's project.json (CLAUDE.md untouched)
const settingsBefore = exists('.claude/settings.json') ? read('.claude/settings.json') : '{}';
execFileSync('node', [join(target, '.claude/std/compose-settings.mjs'), '--root', target, '--skip-claude-md'], { stdio: ['ignore', 'ignore', 'inherit'] });
const settingsAfter = read('.claude/settings.json');
if (settingsAfter !== settingsBefore) updated.push('.claude/settings.json (regenerated)');
manifest['.claude/settings.json'] = hash(settingsAfter);
// Does the new release change the generated command table in CLAUDE.md? (a MAJOR change)
let tableAction = null;
if (exists('CLAUDE.md') && read('CLAUDE.md').includes('<!-- BEGIN GENERATED: std-commands -->')) {
  const tmp = mkdtempSync(join(tmpdir(), 'std-sync-'));
  copyFileSync(join(target, 'CLAUDE.md'), join(tmp, 'CLAUDE.md'));
  execFileSync('node', [join(target, '.claude/std/compose-settings.mjs'), '--root', target, '--settings-out', join(tmp, 'settings.json'), '--claude-md', join(tmp, 'CLAUDE.md')], { stdio: 'ignore' });
  if (readFileSync(join(tmp, 'CLAUDE.md'), 'utf8') !== read('CLAUDE.md')) tableAction = true;
  rmSync(tmp, { recursive: true, force: true });
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

// 6. Version and manifest
write('.claude/std/manifest.json', `${JSON.stringify({ standardVersion: version(), stack: selection, files: Object.fromEntries(Object.entries(manifest).sort()) }, null, 2)}\n`);

const list = (items) => (items.length ? items.map((i) => `- ${i.startsWith('`') || i.includes(' ') ? i : `\`${i}\``}`) : ['- none']);
const out = [
  `## Team AI standard ${previous} → ${version()}`,
  '',
  `Stack **${summary(selection)}**, profile **${project.profile}** (from \`.claude/project.json\`). Read the standard's CHANGELOG for this release before merging.`,
  '',
  'Only standard files (Layer 1) are changed. `CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/` and personal settings are not touched.',
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
  ...(tableAction ? [
    '### Action required: regenerate the command table in CLAUDE.md',
    '',
    'This release changes the format of the generated command table (a MAJOR change of the standard). `CLAUDE.md` belongs to this repository, so this update does not edit it, and `std-check` fails on this PR until the table matches. On this branch, run:',
    '',
    '```bash',
    'node .claude/std/compose-settings.mjs',
    '```',
    '',
    'and commit the change to `CLAUDE.md`. It only rewrites the text between the `std-commands` markers, from `.claude/project.json`.',
    ''
  ] : []),
  '### Review by hand',
  '',
  ...(notManaged.length ? notManaged.map((n) => `- ${n}`) : ['- nothing']),
  ''
].join('\n');

if (summaryFile) writeFileSync(summaryFile, out);
console.log(out);
