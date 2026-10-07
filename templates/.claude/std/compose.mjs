// team-ai-standard: managed file. Do not edit in this repository.
//
// Shared by compose-settings.mjs (in every repository) and by the standard's
// adoption, update and budget scripts, so that what a dry run shows is exactly
// what is written.
//   composeSettings(base, project)  .claude/settings.json content
//   renderBlocks(project)           text of the std blocks in CLAUDE.md
//   applyBlocks(text, blocks)       replace the inside of existing std blocks only
//   insertBlocks(text, blocks)      add missing std blocks after the first H1 and its intro
// A std block is the text between <!-- std:begin <name> --> and <!-- std:end <name> -->.
// Text outside the blocks is never changed. No dependencies.

export const BLOCK_NAMES = ['standard', 'commands'];
export const begin = (name) => `<!-- std:begin ${name} -->`;
export const end = (name) => `<!-- std:end ${name} -->`;

// Order of the command list, with a note where the placeholder name is not enough.
export const COMMANDS = [
  ['install', 'ask first'],
  ['build', ''],
  ['lint', ''],
  ['typecheck', ''],
  ['unit-test', 'append a path for one file'],
  ['integration-test', 'local database'],
  ['migration-show', ''],
  ['migration-generate', 'append a name'],
  ['migration-run', 'local only'],
  ['migration-revert', 'local only']
];

// --- settings.json -------------------------------------------------------------
export function composeSettings(base, project) {
  const commands = project.commands || {};
  const warnings = [];
  const expand = (rules) => rules.flatMap((rule) => {
    let missing = false;
    const next = rule.replace(/<([a-z-]+)-cmd>/g, (_, key) => {
      if (!commands[key]) missing = true;
      return commands[key] || '';
    });
    return missing ? [] : [next];
  });
  const extra = project.permissions || {};
  const settings = JSON.parse(JSON.stringify(base));
  for (const key of ['allow', 'ask', 'deny']) {
    settings.permissions[key] = [...new Set([...expand(base.permissions[key] || []), ...(extra[key] || [])])];
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
  return { text: `${JSON.stringify(settings, null, 2)}\n`, settings, warnings };
}

// --- CLAUDE.md std blocks ----------------------------------------------------------
const stackSummary = (s = {}) => [s.framework, ...(s.databases || []), s.dataAccess === 'none' ? null : s.dataAccess, ...(s.optional || [])]
  .filter(Boolean).join(' + ');

export function renderBlocks(project) {
  const commands = project.commands || {};
  const standard = [
    '## Team AI standard',
    '',
    `- Stack \`${stackSummary(project.stack)}\`, profile \`${project.profile}\`, version in \`.claude/STANDARD_VERSION\`.`,
    '- Never edit standard files: `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, `.claude/settings.json`, `std:` blocks here. Project rules go in `.claude/rules/local/`; commands and permissions in `.claude/project.json`.'
  ];
  const rows = COMMANDS.map(([key, note]) => `- \`<${key}-cmd>\`: ${commands[key] ? `\`${commands[key]}\`` : 'not set'}${note ? ` (${note})` : ''}`);
  const list = [
    '## Commands',
    '',
    'Skills use these placeholders. To change one, edit `.claude/project.json` and run `node .claude/std/compose-settings.mjs`.',
    '',
    ...rows
  ];
  return { standard: standard.join('\n'), commands: list.join('\n') };
}

const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const withEol = (text, eol) => text.replace(/\r?\n/g, eol);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockRe = (name) => new RegExp(`${escape(begin(name))}[\\s\\S]*?${escape(end(name))}`);
const blockText = (name, inner, eol) => withEol(`${begin(name)}\n\n${inner}\n\n${end(name)}`, eol);

export const hasBlock = (text, name) => blockRe(name).test(text);
export const blockInner = (text, name) => {
  const m = blockRe(name).exec(text);
  return m ? m[0].slice(begin(name).length, -end(name).length) : null;
};

export function applyBlocks(text, blocks) {
  const eol = eolOf(text);
  let out = text;
  for (const [name, inner] of Object.entries(blocks)) {
    if (hasBlock(out, name)) out = out.replace(blockRe(name), () => blockText(name, inner, eol));
  }
  return out;
}

// Lines outside fenced code blocks, with their index.
function proseLines(lines) {
  let fence = false;
  return lines.map((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    return { line, i, prose: !fence && !/^\s*(```|~~~)/.test(line) };
  });
}

// Inserts the missing blocks, in order, after the first H1 and its intro (before
// the next heading), at the end when nothing follows the H1, or at the start
// when there is no H1. Existing lines are kept as they are.
export function insertBlocks(text, blocks) {
  const missing = Object.entries(blocks).filter(([name]) => !hasBlock(text, name));
  if (!missing.length) return applyBlocks(text, blocks);
  const eol = eolOf(text);
  const cr = eol === '\r\n' ? '\r' : '';
  if (text.trim() === '') return missing.map(([name, inner]) => blockText(name, inner, eol)).join(eol + eol) + eol;
  const lines = text.split('\n');
  const blank = (l) => l.replace(/\r$/, '') === '';
  const prose = proseLines(lines).filter((l) => l.prose);
  const h1 = prose.find((l) => /^# \S/.test(l.line));
  const next = h1 && prose.find((l) => l.i > h1.i && /^#{1,6} \S/.test(l.line));
  let at = 0;
  const atEnd = Boolean(h1 && !next);
  if (h1) at = next ? next.i : (blank(lines[lines.length - 1]) ? lines.length - 1 : lines.length);
  const chunk = missing.flatMap(([name, inner]) => [...blockText(name, inner, '\n').split('\n'), '']).map((l) => l + cr);
  if (at > 0 && !blank(lines[at - 1])) chunk.unshift(cr);
  if (atEnd) chunk.pop();
  const head = lines.slice(0, at);
  const noFinalNewline = atEnd && at === lines.length;
  if (noFinalNewline) head[at - 1] += cr;
  const out = [...head, ...chunk, ...lines.slice(at)].join('\n');
  return applyBlocks(noFinalNewline ? out + eol : out, blocks);
}

// Headings outside std blocks that probably repeat a std block. Reported, never removed.
const OVERLAP = {
  standard: /\b(ai standard|team standard|ai rules|claude code|ai workflow)\b/i,
  commands: /\b(commands?|scripts?|how to (run|build|test))\b/i
};
export function duplicateHeadings(text) {
  const masked = BLOCK_NAMES.reduce((t, name) => t.replace(blockRe(name), (m) => m.replace(/[^\n]/g, ' ')), text);
  const out = [];
  for (const { line, i, prose } of proseLines(masked.split('\n'))) {
    const m = prose && /^#{1,6} (.+?)\s*$/.exec(line);
    if (!m) continue;
    for (const [name, re] of Object.entries(OVERLAP)) {
      if (re.test(m[1])) out.push({ line: i + 1, heading: line.trim(), block: name });
    }
  }
  return out;
}
