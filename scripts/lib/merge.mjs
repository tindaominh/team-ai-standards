// Merging the standard into files a repository already has (used by adopt.mjs).
// Rules: project content is never deleted or rewritten; permissions are never
// loosened automatically; anything that cannot be merged safely becomes a
// decision for a human.

// Keys of .claude/settings.json the standard knows how to merge. Anything else
// stops adoption: the standard does not guess what an unknown key means.
const KNOWN_TOP = new Set(['$schema', 'permissions', 'enableAllProjectMcpServers', 'cleanupPeriodDays']);
const KNOWN_PERMISSIONS = new Set(['allow', 'ask', 'deny', 'disableBypassPermissionsMode']);

// "Tool(spec)" or "Tool". Matching follows the Claude Code permissions docs
// (https://code.claude.com/docs/en/permissions): "A `*` at the end, with a space
// before it, also matches the bare command" when it is the only wildcard, and a
// trailing ":*" is the same as " *".
import { formatChain, resolveChain } from './script-chain.mjs';

const parse = (rule) => {
  const m = /^([^(]+)(?:\((.*)\))?$/.exec(rule);
  return m ? { tool: m[1], spec: m[2] } : { tool: rule, spec: undefined };
};
const normalizeSpec = (spec) => (spec.endsWith(':*') ? `${spec.slice(0, -2)} *` : spec);
const bareOf = (spec) => (spec.endsWith(' *') && spec.indexOf('*') === spec.length - 1 ? spec.slice(0, -2) : null);
// The texts a spec stands for: itself, plus the bare command for a trailing " *".
const alternatives = (spec) => {
  const s = normalizeSpec(spec);
  const bare = bareOf(s);
  return bare === null ? [s] : [s, bare];
};
const globRe = (spec) => new RegExp(`^${spec.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

// A pattern covers a rule when the tools are equal and everything the rule
// matches is matched by the pattern. A "*" in the rule is treated literally, so a
// broader rule (Bash(git status*)) is not covered by a narrower pattern.
export function covers(pattern, rule) {
  const p = parse(pattern);
  const r = parse(rule);
  if (p.tool !== r.tool) return false;
  if (p.spec === undefined) return true;
  if (r.spec === undefined) return false;
  return alternatives(r.spec).every((text) => alternatives(p.spec).some((s) => globRe(s).test(text)));
}

// Can one command match both rules? Glob intersection where * is the only wildcard.
const globsIntersect = (a, b) => {
  const memo = new Map();
  const f = (i, j) => {
    const key = i * (b.length + 1) + j;
    if (memo.has(key)) return memo.get(key);
    let ok;
    if (i === a.length && j === b.length) ok = true;
    else if (a[i] === '*') ok = f(i + 1, j) || (j < b.length && f(i, j + 1));
    else if (b[j] === '*') ok = f(i, j + 1) || (i < a.length && f(i + 1, j));
    else ok = i < a.length && j < b.length && a[i] === b[j] && f(i + 1, j + 1);
    memo.set(key, ok);
    return ok;
  };
  return f(0, 0);
};
export function overlaps(ruleA, ruleB) {
  const a = parse(ruleA);
  const b = parse(ruleB);
  if (a.tool !== b.tool) return false;
  if (a.spec === undefined || b.spec === undefined) return true;
  return alternatives(a.spec).some((x) => alternatives(b.spec).some((y) => globsIntersect(x, y)));
}

// A hint for an allow rule that needs a human decision. Every such rule gets one.
const HINTS = [
  ['uses cloud credentials', /^(?:(?:npx|npm(?: run| exec)?|pnpm(?: run| exec| dlx)?|yarn(?: run)?) )?(?:cdk|aws|terraform|sam|serverless|sls|pulumi|gcloud|az|firebase|vercel|netlify|copilot|eb)\b/],
  ['runs a long-lived process', /(?:^|[ :])(?:dev|start|serve|watch|preview)\b|--watch\b|^(?:vite|next dev|nest start|nodemon)\b/],
  ['read-only', /^(?:ls|cat|head|tail|grep|rg|find|tree|wc|pwd|which|du|df|stat|git (?:status|diff|log|show|blame|rev-parse|merge-base|ls-files|branch --show-current))\b|--version\b|--help\b|[ :](?:list|ls|show|outdated|status)\b/],
  ['runs repository code (tests, configs, scripts)', /^(?:node|tsx|ts-node|deno|bun|jest|vitest|mocha|eslint|prettier|tsc|nest build|make|bash|sh)\b/]
];
export const NO_HINT = 'no known category: check what it runs';
export function allowHint(rule) {
  const { tool, spec } = parse(rule);
  if (['Read', 'Grep', 'Glob', 'LS'].includes(tool)) return 'read-only';
  if (tool === 'Edit') return 'edits files without asking';
  if (tool !== 'Bash' || spec === undefined) return NO_HINT;
  const hit = HINTS.find(([, re]) => re.test(normalizeSpec(spec)));
  return hit ? hit[0] : NO_HINT;
}

// Does a profile rule match one concrete command? (Bash only.)
export const matchesCommand = (rule, command) => covers(rule, `Bash(${command})`);

// The command an allow rule names, without a trailing " *" or ":*" (null when it has other wildcards).
function commandOf(rule) {
  const { tool, spec } = parse(rule);
  if (tool !== 'Bash' || spec === undefined) return null;
  const s = normalizeSpec(spec);
  const bare = bareOf(s);
  const cmd = bare === null ? s : bare;
  return cmd.includes('*') ? null : cmd;
}

// existingText: current .claude/settings.json. generated: settings the profile
// alone would produce (with the project's commands). choices: per-rule allow
// decisions { carry: [rule], drop: [rule], dropRest: boolean }. scripts: the
// repository's package.json scripts, to see what an allow rule that runs a package
// script really runs (scripts/lib/script-chain.mjs).
// Returns { extra: {allow, ask, deny}, carried, dropped, replaced, decisions, allowReport }.
// Decisions about allow rules have kind 'allow'; they can never be proposed away.
export function mergeSettings(existingText, generated, choices = {}, scripts = {}) {
  const carry = choices.carry || [];
  const drop = choices.drop || [];
  const result = { extra: { allow: [], ask: [], deny: [] }, carried: [], dropped: [], replaced: [], decisions: [], allowReport: [] };
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

  // allow: covered by the profile, unsafe (overlaps a profile ask or deny), or a
  // per-rule human decision.
  const existingAllow = p.allow || [];
  for (const [flag, rules] of [['--carry-allow', carry], ['--drop-allow', drop]]) {
    for (const rule of rules.filter((r) => !existingAllow.includes(r))) {
      result.decisions.push({ kind: 'allow', file: '.claude/settings.json', what: `has no allow rule ${rule} (named with ${flag})`, resolve: 'name the rule exactly as it is written in .claude/settings.json' });
    }
  }
  for (const rule of existingAllow) {
    const by = g.allow.includes(rule) ? rule : g.allow.find((a) => covers(a, rule));
    if (by) { result.allowReport.push({ rule, status: 'covered', by }); continue; }
    const d = g.deny.find((x) => overlaps(x, rule));
    const a = d ? null : g.ask.find((x) => overlaps(x, rule));
    // A package script runs commands the rule does not name: follow the chain.
    const cmd = d || a ? null : commandOf(rule);
    const chain = cmd === null ? null : resolveChain(cmd, scripts, (c) => {
      const deny = g.deny.find((x) => matchesCommand(x, c));
      if (deny) return { rule: deny, list: 'deny' };
      const ask = g.ask.find((x) => matchesCommand(x, c));
      return ask ? { rule: ask, list: 'ask' } : null;
    });
    if (chain && chain.hit) {
      const { rule: by, list } = chain.hit;
      const ran = chain.chain[chain.chain.length - 1];
      result.dropped.push({ list: 'allow', rule, reason: `runs ${ran} through ${formatChain(chain.chain.slice(0, -1))}; the profile ${list === 'deny' ? 'denies' : 'asks'} ${by}` });
      result.allowReport.push({ rule, status: 'unsafe', by, list, chain: chain.chain });
      if (carry.includes(rule)) {
        result.decisions.push({ kind: 'allow', file: '.claude/settings.json', what: `allow ${rule} cannot be carried: it runs ${ran} through ${formatChain(chain.chain.slice(0, -1))} (profile ${list === 'deny' ? 'denies' : 'asks'} ${by})`, resolve: `remove --carry-allow "${rule}"; the rule is dropped` });
      }
      continue;
    }
    if (d || a) {
      const reason = d ? `conflicts with the profile deny ${d}` : `overlaps the profile ask ${a}; ask wins, so the allow cannot be carried`;
      result.dropped.push({ list: 'allow', rule, reason });
      result.allowReport.push({ rule, status: 'unsafe', by: d || a, list: d ? 'deny' : 'ask' });
      if (carry.includes(rule)) {
        result.decisions.push({ kind: 'allow', file: '.claude/settings.json', what: `allow ${rule} cannot be carried: it overlaps the profile ${d ? 'deny' : 'ask'} ${d || a}`, resolve: `remove --carry-allow "${rule}"; the rule is dropped` });
      }
      continue;
    }
    const hint = chain ? scriptHint(chain) : allowHint(rule);
    if (carry.includes(rule)) {
      result.extra.allow.push(rule);
      result.carried.push({ list: 'allow', rule, reason: 'confirmed with --carry-allow' });
      result.allowReport.push({ rule, status: 'carried', hint });
    } else if (drop.includes(rule) || choices.dropRest) {
      result.dropped.push({ list: 'allow', rule, reason: drop.includes(rule) ? 'dropped with --drop-allow' : 'dropped with --drop-allow-rest' });
      result.allowReport.push({ rule, status: 'dropped', hint });
    } else {
      result.allowReport.push({ rule, status: 'needs-decision', hint });
      result.decisions.push({ kind: 'allow', file: '.claude/settings.json', what: `allows what the profile does not: ${rule}${hint ? ` (${hint})` : ''}`, resolve: `--carry-allow "${rule}" keeps it in .claude/project.json, --drop-allow "${rule}" drops it (or --drop-allow-rest for every undecided rule)` });
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

function scriptHint(chain) {
  const parts = [`runs a package script: ${chain.leaves.length ? chain.leaves.join(', ') : 'nothing found'}`];
  if (chain.missing.length) parts.push(`script(s) not found: ${chain.missing.join(', ')}`);
  return parts.join('; ');
}

// Markdown headings, for duplicate-section suggestions in the PR template.
export const headings = (text) => text.split('\n').map((l, i) => ({ line: i + 1, m: /^#{1,6} (.+?)\s*$/.exec(l) })).filter((h) => h.m).map((h) => ({ line: h.line, text: h.m[1] }));

// Appends a block at the end, keeping the existing text byte for byte.
export const appendBlock = (text, block) => `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${text === '' ? '' : '\n'}${block}\n`;
