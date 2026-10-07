// Merging the standard into files a repository already has (used by adopt.mjs).
// Rules: project content is never deleted or rewritten; permissions are never
// loosened automatically; anything that cannot be merged safely becomes a
// decision for a human.

// Keys of .claude/settings.json the standard knows how to merge. Anything else
// stops adoption: the standard does not guess what an unknown key means.
const KNOWN_TOP = new Set(['$schema', 'permissions', 'enableAllProjectMcpServers', 'cleanupPeriodDays']);
const KNOWN_PERMISSIONS = new Set(['allow', 'ask', 'deny', 'disableBypassPermissionsMode']);

// "Tool(spec)" or "Tool". A pattern matches a rule when the tools are equal and
// the pattern's spec (with * as a wildcard) covers the rule's whole spec.
const parse = (rule) => {
  const m = /^([^(]+)(?:\((.*)\))?$/.exec(rule);
  return m ? { tool: m[1], spec: m[2] } : { tool: rule, spec: undefined };
};
export function covers(pattern, rule) {
  const p = parse(pattern);
  const r = parse(rule);
  if (p.tool !== r.tool) return false;
  if (p.spec === undefined) return true;
  if (r.spec === undefined) return false;
  const re = new RegExp(`^${p.spec.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(r.spec);
}

// existingText: current .claude/settings.json. generated: settings the profile
// alone would produce (with the project's commands). allowChoice: 'carry' | 'drop' | undefined.
// Returns { extra: {allow, ask, deny}, carried, dropped, replaced, decisions }.
export function mergeSettings(existingText, generated, allowChoice) {
  const result = { extra: { allow: [], ask: [], deny: [] }, carried: [], dropped: [], replaced: [], decisions: [] };
  let existing;
  try {
    existing = JSON.parse(existingText);
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) throw new Error('not a JSON object');
  } catch (err) {
    result.decisions.push({ file: '.claude/settings.json', what: `cannot be parsed (${err.message})`, resolve: 'fix the file, or pass --propose-unresolved to keep it and get .claude/settings.json.proposed' });
    return result;
  }
  const unknown = [
    ...Object.keys(existing).filter((k) => !KNOWN_TOP.has(k)),
    ...Object.keys(existing.permissions || {}).filter((k) => !KNOWN_PERMISSIONS.has(k)).map((k) => `permissions.${k}`)
  ];
  if (unknown.length) {
    result.decisions.push({ file: '.claude/settings.json', what: `has keys the standard does not merge: ${unknown.join(', ')}`, resolve: 'move them to .claude/settings.local.json (personal) or remove them, or pass --propose-unresolved' });
    return result;
  }
  const g = generated.permissions;
  const p = existing.permissions || {};
  const deniedBy = (rule) => g.deny.find((d) => covers(d, rule));
  const askedBy = (rule) => g.ask.find((a) => covers(a, rule));

  for (const rule of p.deny || []) {
    if (g.deny.includes(rule)) continue;
    result.extra.deny.push(rule);
    result.carried.push({ list: 'deny', rule, reason: 'project-specific deny (stricter, kept)' });
  }
  for (const rule of p.ask || []) {
    if (g.ask.includes(rule)) continue;
    const d = deniedBy(rule);
    if (d) { result.dropped.push({ list: 'ask', rule, reason: `the profile denies it (${d})` }); continue; }
    result.extra.ask.push(rule);
    result.carried.push({ list: 'ask', rule, reason: 'project-specific ask (stricter, kept)' });
  }
  const pendingAllow = [];
  for (const rule of p.allow || []) {
    if (g.allow.includes(rule)) continue;
    const d = deniedBy(rule);
    if (d) { result.dropped.push({ list: 'allow', rule, reason: `conflicts with the profile deny ${d}` }); continue; }
    const a = askedBy(rule);
    if (a) { result.dropped.push({ list: 'allow', rule, reason: `the profile asks (${a}); ask wins, so the allow had no effect` }); continue; }
    pendingAllow.push(rule);
  }
  if (pendingAllow.length) {
    if (allowChoice === 'carry') {
      result.extra.allow.push(...pendingAllow);
      for (const rule of pendingAllow) result.carried.push({ list: 'allow', rule, reason: 'confirmed with --carry-allow' });
    } else if (allowChoice === 'drop') {
      for (const rule of pendingAllow) result.dropped.push({ list: 'allow', rule, reason: 'dropped with --drop-allow' });
    } else {
      result.decisions.push({ file: '.claude/settings.json', what: `allows what the profile does not: ${pendingAllow.join(', ')}`, resolve: 'pass --carry-allow to keep them in .claude/project.json, or --drop-allow' });
    }
  }
  for (const key of ['enableAllProjectMcpServers', 'cleanupPeriodDays']) {
    if (key in existing && existing[key] !== generated[key]) result.replaced.push(`${key}: ${JSON.stringify(existing[key])} → ${JSON.stringify(generated[key])} (profile value)`);
  }
  if ('disableBypassPermissionsMode' in p && p.disableBypassPermissionsMode !== g.disableBypassPermissionsMode) {
    result.replaced.push(`permissions.disableBypassPermissionsMode: ${JSON.stringify(p.disableBypassPermissionsMode)} → ${JSON.stringify(g.disableBypassPermissionsMode)} (profile value)`);
  }
  return result;
}

// Markdown headings, for duplicate-section suggestions in the PR template.
export const headings = (text) => text.split('\n').map((l, i) => ({ line: i + 1, m: /^#{1,6} (.+?)\s*$/.exec(l) })).filter((h) => h.m).map((h) => ({ line: h.line, text: h.m[1] }));

// Appends a block at the end, keeping the existing text byte for byte.
export const appendBlock = (text, block) => `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${text === '' ? '' : '\n'}${block}\n`;
