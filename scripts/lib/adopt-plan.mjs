// Builds the adoption plan: every file adopt.mjs would create, modify or delete,
// the decisions that need a person and optional cleanup suggestions. Pure: reads
// the target repository, writes nothing.
//
// action: create | modify | delete | propose | same. Only "same" writes nothing.
// For a repository that already adopted the standard (`previous` = its project.json),
// only the values that changed are written: project.json keeps its other keys,
// CLAUDE.md only gets its std blocks refreshed, and standard files that the new
// selection no longer needs are deleted (they are listed in the manifest).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyBlocks, composeSettings, duplicateHeadings, insertBlocks, renderBlocks } from '../../templates/.claude/std/compose.mjs';
import { appendBlock, headings, mergeSettings } from './merge.mjs';
import {
  CODEOWNERS_KEY, CODEOWNERS_LOCATIONS, MANAGED_MARKER, PR_BLOCK_RE, PR_KEY, T, claudeSkeleton, codeownersBlock,
  codeownersTemplate, coreFiles, findBlock, hash, optionalFiles, prBlock, prTemplate, version
} from './standard.mjs';

// Keys of project.json that adoption owns; on a re-run only these may change.
const CONFIG_KEYS = ['stack', 'profile', 'repoOwner', 'optionalGroups', 'acknowledgedUnsupported'];
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical).sort();
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
};
const sameValue = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b ?? null));

export function buildPlan(ctx) {
  const { target, selection, profile, repoOwner, withDocs, commands, acknowledgedUnsupported, allowChoices, propose, previous } = ctx;
  const exists = (p) => existsSync(join(target, p));
  const read = (p) => readFileSync(join(target, p), 'utf8');
  const actions = [];
  const decisions = [];
  const suggestions = [];
  const manifest = {};
  const change = (path, after, extra = {}) => {
    if (!exists(path)) actions.push({ path, action: 'create', after, ...extra });
    else if (read(path) !== after) actions.push({ path, action: 'modify', before: read(path), after, ...extra });
  };

  // Standard files for the selection
  const wanted = [...coreFiles(selection), ...(withDocs ? optionalFiles('docs') : [])];
  for (const { path, content } of wanted) {
    if (path === '.claude/std/manifest.json') continue;
    manifest[path] = hash(content);
    if (!exists(path)) actions.push({ path, action: 'create', after: content });
    else if (read(path) === content) actions.push({ path, action: 'same', after: content });
    else {
      if (propose) actions.push({ path: `${path}.proposed`, action: 'propose', after: content, original: path, note: 'exists and differs from the standard file' });
      decisions.push({ file: path, what: 'exists and differs from the standard file', resolve: 'remove or rename your file, or pass --propose-unresolved', proposable: true });
    }
  }
  if (previous && exists('.claude/std/manifest.json')) {
    const wantedPaths = new Set(wanted.map((f) => f.path));
    for (const path of Object.keys(JSON.parse(read('.claude/std/manifest.json')).files || {})) {
      if (path.includes('#') || ['.claude/settings.json', '.github/pull_request_template.md'].includes(path)) continue;
      if (!wantedPaths.has(path) && exists(path)) actions.push({ path, action: 'delete', before: read(path), note: 'standard file the selection no longer needs' });
    }
  }

  // project.json and settings.json
  const config = { stack: selection, profile, repoOwner: repoOwner || null, optionalGroups: withDocs ? ['docs'] : [], acknowledgedUnsupported };
  const base = JSON.parse(readFileSync(join(T, `.claude/std/settings.${profile}.json`), 'utf8'));
  let project;
  let merge = null;
  if (previous) {
    project = { ...previous };
    for (const key of CONFIG_KEYS) if (!sameValue(previous[key], config[key])) project[key] = config[key];
    if (CONFIG_KEYS.some((key) => !sameValue(previous[key], config[key]))) {
      actions.push({ path: '.claude/project.json', action: 'modify', before: read('.claude/project.json'), after: `${JSON.stringify(project, null, 2)}\n` });
    }
  } else {
    project = { ...config, hooks: false, commands, permissions: { allow: [], ask: [], deny: [] } };
    if (exists('.claude/settings.json')) {
      merge = mergeSettings(read('.claude/settings.json'), composeSettings(base, project).settings, allowChoices);
      project.permissions = merge.extra;
      for (const d of merge.decisions) decisions.push({ ...d, proposable: d.kind !== 'allow' });
    }
    actions.push({ path: '.claude/project.json', action: 'create', after: `${JSON.stringify(project, null, 2)}\n`, showDiff: true });
    if (!exists('.claude/rules/local/.gitkeep')) actions.push({ path: '.claude/rules/local/.gitkeep', action: 'create', after: '' });
  }
  const settings = composeSettings(base, project).text;
  const unmergeable = merge && merge.decisions.some((d) => d.kind !== 'allow');
  if (unmergeable) {
    if (propose) actions.push({ path: '.claude/settings.json.proposed', action: 'propose', after: settings, original: '.claude/settings.json', note: 'generated settings; your file was not changed' });
  } else change('.claude/settings.json', settings);
  if (!(merge && merge.decisions.length)) manifest['.claude/settings.json'] = hash(settings);

  // CLAUDE.md: the standard owns only its std blocks
  const blocks = renderBlocks(project);
  if (exists('CLAUDE.md')) {
    const before = read('CLAUDE.md');
    // A re-run refreshes existing blocks only; a block the team removed is not added back.
    const after = previous ? applyBlocks(before, blocks) : insertBlocks(before, blocks);
    change('CLAUDE.md', after);
    if (!previous) for (const d of duplicateHeadings(after)) suggestions.push(`CLAUDE.md:${d.line} "${d.heading}" may repeat the std "${d.block}" block; remove it by hand if so (not changed).`);
  } else if (!previous) {
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
    change('.github/pull_request_template.md', after);
    if (after === pr) manifest['.github/pull_request_template.md'] = hash(pr);
    else {
      manifest[PR_KEY] = hash(inner);
      const ours = new Set(headings(pr).map((h) => h.text.toLowerCase()));
      if (!previous) for (const h of headings(before)) if (ours.has(h.text.toLowerCase())) suggestions.push(`.github/pull_request_template.md:${h.line} "${h.text}" repeats a section of the standard block; remove it by hand if so (not changed).`);
    }
  }

  // CODEOWNERS: the standard block (with the project owner) is appended or refreshed
  const block = codeownersBlock(repoOwner);
  const coPath = CODEOWNERS_LOCATIONS.find(exists);
  if (coPath) {
    const before = read(coPath);
    const found = findBlock(before);
    change(coPath, found ? before.slice(0, found.start) + block + before.slice(found.end) : appendBlock(before, block));
    manifest[`${coPath}${CODEOWNERS_KEY}`] = hash(block);
  } else if (!repoOwner) {
    decisions.push({ file: '.github/CODEOWNERS', what: 'needs the owner of this repository\'s project files', resolve: 'pass --repo-owner @org/team (or @user)' });
  } else {
    const { full, block: templateBlock } = codeownersTemplate();
    actions.push({ path: '.github/CODEOWNERS', action: 'create', after: full.replace(templateBlock, block).replace(/@<org>\/<repo-team>/g, repoOwner) });
    manifest[`.github/CODEOWNERS${CODEOWNERS_KEY}`] = hash(block);
  }

  change('.claude/std/manifest.json', `${JSON.stringify({ standardVersion: version(), stack: selection, files: Object.fromEntries(Object.entries(manifest).sort()) }, null, 2)}\n`);
  const proposals = actions.filter((a) => a.action === 'propose');
  if (proposals.length) {
    const lines = ['# Team AI standard: adoption checklist', '', 'These files could not be merged automatically. Merge each `.proposed` file into your file, delete it, then delete this checklist.', ''];
    for (const p of proposals) lines.push(`- [ ] \`${p.original}\`: ${p.note}; compare with \`${p.path}\`.`);
    lines.push('- [ ] Run `node .claude/std/compose-settings.mjs --check`.', '');
    actions.push({ path: '.claude/std-adoption-checklist.md', action: 'create', after: lines.join('\n') });
  }
  actions.sort((a, b) => a.path.localeCompare(b.path));
  return { actions, decisions, suggestions, merge, project, proposals };
}
