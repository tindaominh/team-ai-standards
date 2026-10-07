#!/usr/bin/env node
// Updates one project repository checkout to the current version of the team
// standard. Used by .github/workflows/standard-update.yml; can also be run by
// hand. It never commits or pushes.
//
//   node scripts/sync-standard.mjs --target <dir> --profile strict|standard [--summary <file>]
//
// What it changes in the target:
//   - Managed files (rules, agents, team skills, PR template): overwritten with
//     the template version.
//   - Hooks: updated only if the repository already uses them (opt-in).
//   - .claude/settings.json: missing deny and ask rules from the profile are
//     ADDED. Nothing is removed and allow rules are never changed; differences
//     are listed in the summary for the repository owner.
//   - .claude/STANDARD_VERSION: set to the new version.
// What it never changes: CLAUDE.md, settings allow rules, repository-specific
// rules or skills, anything outside .claude/ and .github/pull_request_template.md.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const T = join(ROOT, 'templates');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const target = arg('target');
const profile = arg('profile') || 'strict';
const summaryFile = arg('summary');
if (!target || !['strict', 'standard'].includes(profile)) {
  console.error('usage: sync-standard.mjs --target <dir> --profile strict|standard [--summary <file>]');
  process.exit(2);
}

const version = readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim();
const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
}) : []);

const lines = [];
const changed = [];

function copyManaged(srcRel, dstRel = srcRel) {
  const src = join(T, srcRel);
  const dst = join(target, dstRel);
  const next = readFileSync(src);
  if (existsSync(dst) && Buffer.compare(readFileSync(dst), next) === 0) return;
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  changed.push(dstRel);
}

// 1. Managed files
const managed = [
  ...walk(join(T, '.claude/rules')),
  ...walk(join(T, '.claude/agents')),
  ...walk(join(T, '.claude/skills'))
].map((p) => relative(T, p));
managed.forEach((p) => copyManaged(p));
copyManaged('.github/pull_request_template.md');

// Files in managed folders that the standard does not ship (repository-specific or removed upstream)
const managedSet = new Set(managed);
const teamSkills = new Set(readdirSync(join(T, '.claude/skills')));
const extras = [
  ...walk(join(target, '.claude/rules/common')),
  ...walk(join(target, '.claude/rules/typescript')),
  ...walk(join(target, '.claude/agents')),
  ...walk(join(target, '.claude/skills')).filter((p) => teamSkills.has(relative(join(target, '.claude/skills'), p).split('/')[0]))
].map((p) => relative(target, p)).filter((p) => !managedSet.has(p));

// 2. Hooks: only if the repository opted in
const hookDir = join(target, '.claude/hooks');
const hooksUsed = existsSync(hookDir);
if (hooksUsed) {
  for (const f of readdirSync(join(T, 'hooks')).filter((n) => n.endsWith('.cjs'))) {
    copyManaged(join('hooks', f), join('.claude/hooks', f));
  }
}

// 3. Settings: add missing deny/ask rules, never remove
const settingsPath = join(target, '.claude/settings.json');
const tplSettings = JSON.parse(readFileSync(join(T, '.claude', profile === 'strict' ? 'settings.json' : 'settings.standard.json'), 'utf8'));
let addedRules = [];
let notInTemplate = [];
if (existsSync(settingsPath)) {
  const cur = JSON.parse(readFileSync(settingsPath, 'utf8'));
  cur.permissions = cur.permissions || {};
  for (const key of ['deny', 'ask']) {
    const have = new Set(cur.permissions[key] || []);
    const want = tplSettings.permissions[key];
    const add = want.filter((r) => !have.has(r));
    if (add.length) {
      cur.permissions[key] = [...(cur.permissions[key] || []), ...add];
      addedRules = addedRules.concat(add.map((r) => `${key}: \`${r}\``));
    }
    const wantSet = new Set(want);
    notInTemplate = notInTemplate.concat([...have].filter((r) => !wantSet.has(r)).map((r) => `${key}: \`${r}\``));
  }
  if (addedRules.length) {
    writeFileSync(settingsPath, `${JSON.stringify(cur, null, 2)}\n`);
    changed.push('.claude/settings.json');
  }
} else {
  lines.push('- `.claude/settings.json` not found: install it from the template by hand (profile: ' + profile + ').');
}

// 4. Version file
const versionPath = join(target, '.claude/STANDARD_VERSION');
const previous = existsSync(versionPath) ? readFileSync(versionPath, 'utf8').trim() : '(none)';
if (previous !== version) {
  mkdirSync(dirname(versionPath), { recursive: true });
  writeFileSync(versionPath, `${version}\n`);
  changed.push('.claude/STANDARD_VERSION');
}

// Summary for the pull request body
const out = [
  `## Team AI standard ${previous} → ${version}`,
  '',
  `Profile: **${profile}**. Read the standard's CHANGELOG for this release before merging.`,
  '',
  '### Files updated',
  '',
  ...(changed.length ? changed.map((f) => `- \`${f}\``) : ['- none']),
  '',
  '### Settings rules added (deny/ask only)',
  '',
  ...(addedRules.length ? addedRules.map((r) => `- ${r}`) : ['- none']),
  '',
  '### Review by hand',
  '',
  '- `CLAUDE.md` is never changed by this job. Compare it with the template if the CHANGELOG mentions CLAUDE.md.',
  '- Command placeholders in new settings rules (for example `<unit-test-cmd>`) must be replaced with this repository\'s commands.',
  ...(notInTemplate.length ? ['- Settings rules in this repository that are not in the template (repository-specific, or removed upstream; remove only if you agree):', ...notInTemplate.map((r) => `  - ${r}`)] : []),
  ...(extras.length ? ['- Files in managed folders that the standard does not ship (repository-specific, or removed upstream):', ...extras.map((f) => `  - \`${f}\``)] : []),
  ...(hooksUsed ? [] : ['- Hooks are not enabled in this repository; they were not touched.']),
  ...lines,
  ''
].join('\n');

if (summaryFile) writeFileSync(summaryFile, out);
console.log(out);
