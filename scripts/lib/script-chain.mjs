// Resolves what an allow rule really runs when it invokes a package script.
// `Bash(pnpm verify)` looks harmless, but "verify" may call "check", which runs
// `cdk synth` with the developer's cloud credentials. Claude Code matches rules
// against the command text it writes, not against what a script runs, so a profile
// ask or deny never sees the inner commands. Pure: no file access.
//
//   resolveChain('pnpm verify', scripts, 'pnpm', flagged)
//     -> { chain: ['pnpm verify', 'pnpm check', 'cdk synth'], hit: { rule, list } | null, missing: [], cycles: [] }
// flagged(cmd) returns { rule, list } when a profile ask or deny matches cmd, else null.

const NPM_BUILTIN_SCRIPTS = new Set(['test', 't', 'start', 'stop', 'restart']);
const ALIASES = { t: 'test' };
// npm and yarn (classic) run pre<name> and post<name> around a script; pnpm does not by default.
const RUNS_HOOKS = new Set(['npm', 'yarn']);

// Splits a shell command line into words, keeping quoted text together.
function words(text) {
  const out = [];
  let cur = '';
  let quote = null;
  let started = false;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started || cur) out.push(cur);
      cur = '';
      started = false;
    } else cur += ch;
  }
  if (started || cur) out.push(cur);
  return out;
}

// Splits a script body into simple commands on &&, ||, ;, | and &, outside quotes.
export function splitCommands(body) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ';' || ch === '|' || ch === '&') {
      if (body[i + 1] === ch && ch !== ';') i += 1;
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim()).filter(Boolean);
}

// Removes leading VAR=value assignments and `cross-env VAR=value`.
export function stripEnv(cmd) {
  const w = words(cmd);
  let i = 0;
  const assignment = (s) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(s);
  while (i < w.length && assignment(w[i])) i += 1;
  if (w[i] === 'cross-env') {
    i += 1;
    while (i < w.length && assignment(w[i])) i += 1;
  }
  return w.slice(i).join(' ');
}

// The script a command runs, or null: { manager, name } for npm/pnpm/yarn invocations.
export function scriptInvocation(cmd, scripts) {
  const w = words(stripEnv(cmd));
  const [tool, sub, name] = w;
  if (!['npm', 'pnpm', 'yarn'].includes(tool) || sub === undefined) return null;
  if (sub === 'run' || sub === 'run-script') return name ? { manager: tool, name } : null;
  if (tool === 'npm') return NPM_BUILTIN_SCRIPTS.has(sub) ? { manager: tool, name: ALIASES[sub] || sub } : null;
  // pnpm <name> and yarn <name>: shorthand for a script when one has that name.
  return sub in scripts ? { manager: tool, name: sub } : null;
}

// Script names a run-s / run-p / npm-run-all command runs, with * patterns expanded.
function runAllTargets(cmd, scripts) {
  const w = words(stripEnv(cmd));
  if (!['run-s', 'run-p', 'npm-run-all'].includes(w[0])) return null;
  const names = [];
  for (const arg of w.slice(1)) {
    if (arg === '--') break;
    if (arg.startsWith('-')) continue;
    if (arg.includes('*')) {
      const re = new RegExp(`^${arg.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^:]*')}$`);
      names.push(...Object.keys(scripts).filter((n) => re.test(n)));
    } else names.push(arg);
  }
  return names;
}

const invoke = (manager, name) => (manager === 'npm' ? (name === 'test' || name === 'start' ? `npm ${name}` : `npm run ${name}`) : `${manager} ${name}`);

// Walks every command the script runs. Returns null when `command` does not invoke a
// package script. Otherwise { chain, hit, leaves, missing, cycles }:
//   hit     { rule, list } of the first command a profile ask or deny matches, or null
//   chain   the commands from `command` to that hit, as written in package.json
//   leaves  every command reached that is not itself a package script (for the hint)
export function resolveChain(command, scripts = {}, flagged = () => null) {
  if (!scriptInvocation(command, scripts)) return null;
  const result = { chain: [], hit: null, leaves: [], missing: [], cycles: [] };

  const visit = (cmd, path, seen, depth) => {
    const here = [...path, stripEnv(cmd)];
    const hit = flagged(stripEnv(cmd));
    if (hit) {
      result.chain = here;
      result.hit = hit;
      return true;
    }
    const call = scriptInvocation(cmd, scripts);
    const all = call ? null : runAllTargets(cmd, scripts);
    if (!call && !all) {
      if (!result.leaves.includes(stripEnv(cmd))) result.leaves.push(stripEnv(cmd));
      return false;
    }
    const targets = call ? [{ name: call.name, step: here, hooks: RUNS_HOOKS.has(call.manager) }]
      : all.map((name) => ({ name, step: [...here, invoke('npm', name)], hooks: true }));
    for (const { name, step, hooks } of targets) {
      if (!(name in scripts)) {
        if (!result.missing.includes(name)) result.missing.push(name);
        continue;
      }
      if (seen.has(name) || depth > 20) {
        if (!result.cycles.includes(name)) result.cycles.push(name);
        continue;
      }
      const next = new Set(seen).add(name);
      for (const part of hooks ? [`pre${name}`, name, `post${name}`] : [name]) {
        if (!(part in scripts)) continue;
        const via = part === name ? step : [...step, `(${part})`];
        for (const inner of splitCommands(scripts[part])) if (visit(inner, via, next, depth + 1)) return true;
      }
    }
    return false;
  };
  visit(command, [], new Set(), 0);
  return result;
}

export const formatChain = (chain) => chain.join(' → ');
