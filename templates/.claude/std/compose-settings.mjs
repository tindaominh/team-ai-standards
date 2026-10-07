#!/usr/bin/env node
// team-ai-standard: managed file. Do not edit in this repository.
//
// Builds .claude/settings.json from the team standard's base profile
// (.claude/std/settings.<profile>.json) and this repository's choices in
// .claude/project.json, and regenerates the command table in CLAUDE.md
// (between the "std-commands" markers).
//
//   node .claude/std/compose-settings.mjs           write settings.json and the CLAUDE.md table
//   node .claude/std/compose-settings.mjs --check   fail if they are stale, or if a
//                                                   standard file listed in
//                                                   .claude/std/manifest.json was edited, or if
//                                                   *.proposed files, the adoption checklist or
//                                                   .claude/settings.local.json are tracked by git
// Options (used by the adoption and update scripts): --root <dir> --settings-out <path>
//   --claude-md <path>, --skip-claude-md (the update job never touches CLAUDE.md)
// No dependencies, no network. Reads and writes only inside the repository.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};
const CHECK = args.includes('--check');
const ROOT = opt('root', process.cwd());
const SETTINGS_OUT = opt('settings-out', '.claude/settings.json');
const CLAUDE_MD = opt('claude-md', 'CLAUDE.md');
const SKIP_CLAUDE_MD = args.includes('--skip-claude-md');
const PROJECT = '.claude/project.json';
const MANIFEST = '.claude/std/manifest.json';
const BLOCK = { begin: '# BEGIN team-ai-standard', end: '# END team-ai-standard' };

// Order and labels of the command table.
const COMMANDS = [
  ['install', 'Install dependencies (ask first)'],
  ['build', 'Build'],
  ['lint', 'Lint'],
  ['typecheck', 'Typecheck'],
  ['unit-test', 'Unit tests (one file: append the path)'],
  ['integration-test', 'Integration tests, local database container'],
  ['migration-show', 'List migrations and their status'],
  ['migration-generate', 'Generate a migration (append the name)'],
  ['migration-run', 'Run migrations on the local database'],
  ['migration-revert', 'Revert the last migration locally']
];

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const here = (p) => existsSync(resolve(ROOT, p));
const hash = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const problems = [];
const warnings = [];

function fail(msg) {
  console.error(`std: ${msg}`);
  process.exit(1);
}

if (!existsSync(join(ROOT, PROJECT))) fail(`${PROJECT} not found. This repository has not adopted the team standard.`);
const project = JSON.parse(read(PROJECT));
const profile = project.profile;
if (!['strict', 'standard'].includes(profile)) fail(`${PROJECT}: "profile" must be "strict" or "standard".`);
const basePath = `.claude/std/settings.${profile}.json`;
if (!existsSync(join(ROOT, basePath))) fail(`${basePath} not found.`);
const base = JSON.parse(read(basePath));
const commands = project.commands || {};

// A command becomes part of permission rules, so it must be a single command.
for (const [key, value] of Object.entries(commands)) {
  if (value === null || value === '') continue;
  if (typeof value !== 'string' || /[;&|`$<>\n]/.test(value)) {
    fail(`${PROJECT}: commands.${key} must be one plain command without ; & | \` $ < > (got ${JSON.stringify(value)}).`);
  }
}

// --- settings.json ---------------------------------------------------------
function expand(rules) {
  const out = [];
  for (const rule of rules) {
    let missing = false;
    const next = rule.replace(/<([a-z-]+)-cmd>/g, (_, key) => {
      const value = commands[key];
      if (!value) missing = true;
      return value || '';
    });
    if (!missing) out.push(next);
  }
  return out;
}
const unique = (list) => [...new Set(list)];

const extra = project.permissions || {};
const settings = JSON.parse(JSON.stringify(base));
for (const key of ['allow', 'ask', 'deny']) {
  settings.permissions[key] = unique([...expand(base.permissions[key] || []), ...(extra[key] || [])]);
}
for (const rule of extra.allow || []) {
  if (settings.permissions.deny.includes(rule)) warnings.push(`project allow rule is also denied by the standard and has no effect: ${rule}`);
}
if (project.hooks === true) {
  const hook = (file) => ({ type: 'command', command: `node "$CLAUDE_PROJECT_DIR"/.claude/std/hooks/${file}` });
  settings.hooks = {
    PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [{ ...hook('format-check-on-edit.cjs'), timeout: 30 }] }],
    Stop: [{ hooks: [{ ...hook('typecheck-on-stop.cjs'), timeout: 120 }] }]
  };
}
const settingsText = `${JSON.stringify(settings, null, 2)}\n`;

// --- CLAUDE.md command table ----------------------------------------------
const MARK_BEGIN = '<!-- BEGIN GENERATED: std-commands -->';
const MARK_END = '<!-- END GENERATED: std-commands -->';
const tableRows = COMMANDS.map(([key, label]) => {
  const value = commands[key];
  const cmd = value ? `\`${value}\`` : `TODO: set "${key}" in \`.claude/project.json\``;
  return `| \`<${key}-cmd>\` | ${label} | ${cmd} |`;
});
const table = [MARK_BEGIN, '', '| Placeholder | Purpose | Command |', '| --- | --- | --- |', ...tableRows, '', MARK_END].join('\n');
const blockRe = /<!-- BEGIN GENERATED: std-commands -->[\s\S]*?<!-- END GENERATED: std-commands -->/;

let claudeText = null;
let claudeNext = null;
if (!SKIP_CLAUDE_MD && here(CLAUDE_MD)) {
  claudeText = read(CLAUDE_MD);
  if (blockRe.test(claudeText)) claudeNext = claudeText.replace(blockRe, table);
  else warnings.push(`${CLAUDE_MD} has no std-commands markers; the command table is not generated.`);
  if (/TODO\(adopt\)/.test(claudeText)) warnings.push(`${CLAUDE_MD} still contains TODO(adopt) sections.`);
}
for (const [key] of COMMANDS) if (!commands[key]) warnings.push(`commands.${key} is not set; its permission rules are left out.`);

// --- dependencies the standard has no fragment for -----------------------------
// Warn for each one that the repository has not acknowledged in project.json.
const UNSUPPORTED = '.claude/std/unsupported.json';
if (here(UNSUPPORTED) && here('package.json')) {
  const list = JSON.parse(read(UNSUPPORTED));
  const pkg = JSON.parse(read('package.json'));
  const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  const acknowledged = new Set(project.acknowledgedUnsupported || []);
  for (const dep of Object.keys(list)) {
    if (deps.has(dep) && !acknowledged.has(dep)) {
      warnings.push(`package.json depends on ${dep}, which has no ${list[dep] === 'dataAccess' ? 'data-access' : list[dep]} fragment in the team standard. Add a fragment (standard docs, 11-adding-a-stack-fragment), or if the stack selection in .claude/project.json is right, add "${dep}" to "acknowledgedUnsupported".`);
    }
  }
}

// --- manifest of standard files --------------------------------------------
function currentHash(entry) {
  if (entry.endsWith('#team-ai-standard')) {
    const file = entry.split('#')[0];
    if (!existsSync(join(ROOT, file))) return null;
    const text = read(file);
    const a = text.indexOf(BLOCK.begin);
    const b = text.indexOf(BLOCK.end);
    return a > -1 && b > a ? hash(text.slice(a, b + BLOCK.end.length)) : null;
  }
  return existsSync(join(ROOT, entry)) ? hash(read(entry)) : null;
}

const manifest = existsSync(join(ROOT, MANIFEST)) ? JSON.parse(read(MANIFEST)) : null;
// Compare selections independent of key order and array order.
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical).sort();
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
};
if (manifest && manifest.stack && JSON.stringify(canonical(manifest.stack)) !== JSON.stringify(canonical(project.stack))) {
  warnings.push('the stack selection in .claude/project.json differs from the installed fragments; the next update PR installs the matching rules (or ask the owner of the standard to run the update now).');
}

if (CHECK) {
  const current = here(SETTINGS_OUT) ? read(SETTINGS_OUT) : '';
  if (current !== settingsText) problems.push(`${SETTINGS_OUT} does not match .claude/project.json and the standard base. Run: node .claude/std/compose-settings.mjs`);
  if (claudeNext !== null && claudeNext !== claudeText) problems.push(`${CLAUDE_MD} command table is stale. Run: node .claude/std/compose-settings.mjs`);
  if (!manifest) problems.push(`${MANIFEST} not found.`);
  else {
    for (const [entry, expected] of Object.entries(manifest.files || {})) {
      if (entry === SETTINGS_OUT) continue; // checked above against its sources
      const actual = currentHash(entry);
      if (actual === null) problems.push(`standard file missing: ${entry}`);
      else if (actual !== expected) problems.push(`standard file edited in this repository: ${entry}. Standard files change only through update PRs; put project changes in .claude/project.json or .claude/rules/local/.`);
    }
  }
  // Files that must never be committed
  let tracked = null;
  try {
    tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    warnings.push('not a git checkout; skipped the check for committed *.proposed and personal settings files.');
  }
  if (tracked) {
    for (const f of tracked.filter((p) => p.endsWith('.proposed'))) problems.push(`adoption proposal committed: ${f}. Merge it into the real file and delete it.`);
    if (tracked.includes('.claude/std-adoption-checklist.md')) problems.push('adoption checklist committed: .claude/std-adoption-checklist.md. Delete it after merging the proposals.');
    if (tracked.includes('.claude/settings.local.json')) problems.push('personal settings committed: .claude/settings.local.json. Remove it from git (git rm --cached) and add it to .gitignore.');
  }
  for (const w of warnings) console.log(`warning: ${w}`);
  if (problems.length) {
    console.error(problems.map((p) => `FAIL: ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('PASS: team AI standard files and generated settings are consistent.');
} else {
  const outPath = resolve(ROOT, SETTINGS_OUT);
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== settingsText) {
    writeFileSync(outPath, settingsText);
    console.log(`wrote ${SETTINGS_OUT}`);
  }
  if (claudeNext !== null && claudeNext !== claudeText) {
    writeFileSync(resolve(ROOT, CLAUDE_MD), claudeNext);
    console.log(`updated command table in ${CLAUDE_MD}`);
  }
  if (manifest && SETTINGS_OUT === '.claude/settings.json' && manifest.files && SETTINGS_OUT in manifest.files) {
    manifest.files[SETTINGS_OUT] = hash(settingsText);
    writeFileSync(join(ROOT, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const w of warnings) console.log(`warning: ${w}`);
}
