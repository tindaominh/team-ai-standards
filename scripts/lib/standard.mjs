// Shared by scripts/adopt.mjs, scripts/sync-standard.mjs and the checks.
// Computes the Layer 1 (STANDARD) files for a stack selection: the exact
// content a project repository receives. Layer 2 (PROJECT) and Layer 3
// (PERSONAL) files are never produced here.
//
// A stack selection is composable:
//   { runtime: 'node', framework: 'nestjs', databases: ['mysql'], dataAccess: 'typeorm', optional: ['aws'] }
// The allowed values live in templates/fragments/fragments.json. Fragment files
// follow a convention: templates/fragments/<folder>/<value>/
//   rule.md       -> .claude/rules/std/fragments/<folder>-<value>.md
//   tdd.md        -> .claude/skills/std-tdd-workflow/<folder>-<value>.md
//   migration.md  -> .claude/skills/std-db-migration-review/<folder>-<value>.md
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BLOCK_NAMES, applyBlocks } from '../../templates/.claude/std/compose.mjs';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const T = join(ROOT, 'templates');
export const F = join(T, 'fragments');
export const MANAGED_MARKER = 'team-ai-standard: managed';
export const BLOCK_BEGIN = '# BEGIN team-ai-standard';
export const BLOCK_END = '# END team-ai-standard';
export const CODEOWNERS_KEY = '#team-ai-standard';
export const CODEOWNERS_LOCATIONS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];
export const DIMENSIONS = ['framework', 'databases', 'dataAccess', 'optional'];
const FRAGMENT_OUTPUTS = {
  'rule.md': (name) => `.claude/rules/std/fragments/${name}.md`,
  'tdd.md': (name) => `.claude/skills/std-tdd-workflow/${name}.md`,
  'migration.md': (name) => `.claude/skills/std-db-migration-review/${name}.md`
};

// Optional groups: installed only on request, then kept up to date because
// they are listed in the repository's manifest.
export const OPTIONAL = {
  docs: [
    ['scripts/generate-docs.mjs', 'scripts/generate-docs.mjs'],
    ['scripts/check-docs-updated.mjs', 'scripts/check-docs-updated.mjs'],
    ['scripts/export-env-schema.ts', 'scripts/export-env-schema.ts'],
    ['.github/workflows/docs-check.yml', '.github/workflows/docs-check.yml'],
    ['.github/workflows/docs-notify.yml', '.github/workflows/docs-notify.yml']
  ]
};

// Guard files: editing them changes what allowed commands run (package scripts, tool
// configs, git hooks, workflows) or weakens guardrails (project rules). Both profiles ask
// before Edit(rule); the CODEOWNERS block gives them to the project owner (codeowners).
export const GUARD_FILES = [
  { rule: '**/package.json', codeowners: 'package.json' },
  { rule: '/.claude/project.json', codeowners: '/.claude/project.json' },
  { rule: '/.claude/rules/local/**', codeowners: '/.claude/rules/local/' },
  { rule: '/.husky/**', codeowners: '/.husky/' },
  { rule: '/.github/workflows/**', codeowners: '/.github/workflows/' },
  { rule: '**/eslint.config.*', codeowners: 'eslint.config.*' },
  { rule: '**/.eslintrc*', codeowners: '.eslintrc*' },
  { rule: '**/vitest.config.*', codeowners: 'vitest.config.*' },
  { rule: '**/jest.config.*', codeowners: 'jest.config.*' },
  { rule: '**/tsconfig*.json', codeowners: 'tsconfig*.json' }
];

export const hash = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');

export function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export const version = () => readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim();
export const registry = () => JSON.parse(readFileSync(join(F, 'fragments.json'), 'utf8'));

// --- selections -------------------------------------------------------------
const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean));

export function expandAlias(name) {
  const alias = registry().aliases[name];
  if (!alias) throw new Error(`unknown --stack alias "${name}". Aliases: ${Object.keys(registry().aliases).join(', ')}`);
  return normalize(alias);
}

// Accepts the project.json form, a legacy alias string, or partial input.
export function normalize(sel) {
  if (typeof sel === 'string') return expandAlias(sel);
  return {
    runtime: (sel && sel.runtime) || registry().runtime,
    framework: sel ? sel.framework : undefined,
    databases: [...new Set(asList(sel && sel.databases))].sort(),
    dataAccess: sel ? sel.dataAccess : undefined,
    optional: [...new Set(asList(sel && sel.optional))].sort()
  };
}

export function validate(sel) {
  const reg = registry().dimensions;
  const errors = [];
  const warnings = [];
  const values = (dim) => Object.keys(reg[dim].values);
  if (sel.runtime !== registry().runtime) errors.push(`runtime must be "${registry().runtime}"`);
  if (!values('framework').includes(sel.framework)) errors.push(`framework must be one of: ${values('framework').join(', ')} (got ${JSON.stringify(sel.framework)})`);
  for (const db of sel.databases) if (!values('databases').includes(db)) errors.push(`unknown database "${db}"; choose from: ${values('databases').join(', ')}`);
  if (!values('dataAccess').includes(sel.dataAccess)) errors.push(`data access must be one of: ${values('dataAccess').join(', ')} (got ${JSON.stringify(sel.dataAccess)})`);
  for (const o of sel.optional) if (!values('optional').includes(o)) errors.push(`unknown optional fragment "${o}"; choose from: ${values('optional').join(', ')}`);
  if (sel.dataAccess && sel.dataAccess !== 'none' && sel.databases.length === 0) errors.push(`data access "${sel.dataAccess}" needs at least one database (--db)`);
  if (sel.dataAccess === 'none' && sel.databases.length > 0) errors.push(`databases are selected but data access is "none"; choose ${values('dataAccess').filter((v) => v !== 'none').join(' or ')}`);
  if (sel.databases.length > 1) warnings.push(`more than one database (${sel.databases.join(', ')}): make sure each module states which database it uses`);
  if (sel.framework === 'nestjs' && sel.dataAccess === 'raw') warnings.push('NestJS with a raw driver is unusual: wrap the pool in a provider and keep SQL in one data-access layer');
  return { errors, warnings };
}

export function describe(sel) {
  const reg = registry().dimensions;
  const parts = [reg.framework.values[sel.framework].label];
  if (sel.databases.length) parts.push(sel.databases.map((d) => reg.databases.values[d].label).join(' + '));
  if (sel.dataAccess !== 'none') parts.push(reg.dataAccess.values[sel.dataAccess].label);
  if (sel.optional.length) parts.push(sel.optional.map((o) => reg.optional.values[o].label).join(', '));
  return parts.join(', ');
}
export const summary = (sel) => [sel.framework, ...sel.databases, sel.dataAccess === 'none' ? null : sel.dataAccess, ...sel.optional].filter(Boolean).join(' + ');

// --- detection --------------------------------------------------------------
// Returns { selection, notes, ambiguous: [{ dimension, options, hint }], unsupported: [{ dep, dimension }] }.
export function detect(dir) {
  const reg = registry().dimensions;
  const pkgPath = join(dir, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {};
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const has = (pattern) => (pattern.endsWith('/*') ? deps.some((d) => d.startsWith(pattern.slice(0, -1))) : deps.includes(pattern));
  const matches = (dim) => Object.entries(reg[dim].values).filter(([, v]) => (v.detect || []).some(has)).map(([k]) => k);
  const notes = [];
  const ambiguous = [];

  let frameworks = matches('framework');
  for (const f of [...frameworks]) for (const lower of reg.framework.values[f].outranks || []) frameworks = frameworks.filter((x) => x !== lower);
  let framework;
  if (frameworks.length === 1) framework = frameworks[0];
  else if (frameworks.length === 0) {
    framework = 'none';
    notes.push('framework: no web framework dependency found, so "none"');
  } else ambiguous.push({ dimension: 'framework', options: frameworks, hint: `--framework ${frameworks.join('|')}` });

  const orms = matches('dataAccess');
  const databases = matches('databases').sort();

  let dataAccess;
  if (orms.length > 1) ambiguous.push({ dimension: 'dataAccess', options: orms, hint: `--data-access ${orms.join('|')}` });
  else if (orms.length === 1) dataAccess = orms[0];
  else if (databases.length) {
    dataAccess = 'raw';
    notes.push('data access: a database driver but no ORM, so "raw"');
  } else dataAccess = 'none';
  if (dataAccess && dataAccess !== 'none' && databases.length === 0) {
    ambiguous.push({ dimension: 'databases', options: Object.keys(reg.databases.values), hint: `--db ${Object.keys(reg.databases.values).join('|')}` });
  }

  // Dependencies the standard has no fragment for: never map them silently to another value.
  const unsupported = unsupportedIn(dir);

  const optional = Object.entries(reg.optional.values)
    .filter(([, v]) => (v.detect || []).some(has) || (v.detectPaths || []).some((p) => existsSync(join(dir, p))))
    .map(([k]) => k);

  return { selection: normalize({ framework, databases, dataAccess, optional }), notes, ambiguous, unsupported };
}

// Unsupported dependencies present in a repository: [{ dep, dimension }]
export function unsupportedIn(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  return Object.entries(registry().unsupported || {}).filter(([dep]) => deps.has(dep)).map(([dep, dimension]) => ({ dep, dimension }));
}

// Optional fragments that used to be common rules. A repository that had one keeps it
// until it records a choice: sync and adopt treat it as selected while the manifest lists
// the old common file or the fragment and .claude/project.json does not select it.
export const LEGACY_OPTIONAL = {
  marketplace: ['.claude/rules/std/common/marketplace-integration.md', '.claude/rules/std/fragments/optional-marketplace.md']
};
export function keptOptional(manifestFiles, sel) {
  return Object.entries(LEGACY_OPTIONAL)
    .filter(([name, paths]) => !sel.optional.includes(name) && paths.some((p) => manifestFiles.includes(p)))
    .map(([name]) => name);
}

// GitHub environments referenced by workflow files: [{ path, name }]. Adoption cannot see
// the repository's GitHub plan or settings (no network), so it lists them for a human.
export function workflowEnvironments(files) {
  return files
    .filter((f) => f.path.startsWith('.github/workflows/') && typeof f.content === 'string')
    .flatMap((f) => [...f.content.matchAll(/^\s+environment:\s*([\w.-]+)\s*$/gm)].map((m) => ({ path: f.path, name: m[1] })));
}
export const ENVIRONMENT_NOTE = 'Create each environment in the repository settings before the workflow runs: secrets as environment secrets, deployment branches limited to the protected default branch, required reviewers where the plan offers them. Private repositories: GitHub Free cannot protect environments (they block nothing), GitHub Pro and Team have no required reviewers (standard doc 05, section 6.1).';

export const FLAG_FOR = { framework: '--framework', databases: '--db', dataAccess: '--data-access', optional: '--with' };

// --- files ---------------------------------------------------------------------
const fill = (text, vars) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

function fragmentVars(sel) {
  const dbs = registry().dimensions.databases.values;
  const first = sel.databases[0] ? dbs[sel.databases[0]].vars : { DB_TYPE: '<database>', DB_PORT: '<port>' };
  return { ...first, DB_LABEL: sel.databases.map((d) => dbs[d].label).join(' / ') || 'database' };
}

export function selectedFragments(sel) {
  const reg = registry().dimensions;
  const out = [];
  for (const dim of DIMENSIONS) {
    const folder = reg[dim].folder;
    const chosen = reg[dim].multiple ? sel[dim] : [sel[dim]];
    for (const value of chosen) out.push({ dim, folder, value, name: `${folder}-${value}`, dir: join(F, folder, value) });
  }
  return out;
}

export function fragmentFiles(sel) {
  const vars = fragmentVars(sel);
  const out = [];
  for (const frag of selectedFragments(sel)) {
    for (const [file, dest] of Object.entries(FRAGMENT_OUTPUTS)) {
      const src = join(frag.dir, file);
      if (existsSync(src)) out.push({ path: dest(frag.name), content: fill(readFileSync(src, 'utf8'), vars) });
    }
  }
  return out;
}

// Layer 1 files that every adopted repository has, for its selection: [{ path, content }]
export function coreFiles(selection) {
  const sel = normalize(selection);
  const out = [];
  for (const dir of ['.claude/rules/std', '.claude/agents', '.claude/skills', '.claude/std']) {
    for (const file of walk(join(T, dir))) out.push({ path: relative(T, file), content: readFileSync(file, 'utf8') });
  }
  out.push({ path: '.claude/STANDARD_VERSION', content: readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8') });
  out.push({ path: '.github/workflows/std-check.yml', content: readFileSync(join(T, '.github/workflows/std-check.yml'), 'utf8') });
  // Copy of the registry's unsupported list, so the repository's own std-check can warn without the standard.
  const unsupported = registry().unsupported || {};
  out.push({ path: '.claude/std/unsupported.json', content: `${JSON.stringify(Object.fromEntries(Object.keys(unsupported).sort().map((k) => [k, unsupported[k]])), null, 2)}\n` });
  out.push(...fragmentFiles(sel));
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function optionalFiles(group) {
  return (OPTIONAL[group] || []).map(([src, dest]) => ({ path: dest, content: readFileSync(join(T, src), 'utf8') }));
}

export const prTemplate = () => readFileSync(join(T, '.github/pull_request_template.md'), 'utf8');

// The PR template as a std block, appended to a repository's existing template.
export const PR_BLOCK = 'pr-template';
export const PR_KEY = `.github/pull_request_template.md#std:${PR_BLOCK}`;
export function prBlock() {
  const inner = `\n${prTemplate()}`;
  return { inner, text: `<!-- std:begin ${PR_BLOCK} -->${inner}<!-- std:end ${PR_BLOCK} -->` };
}
export const PR_BLOCK_RE = new RegExp(`<!-- std:begin ${PR_BLOCK} -->[\\s\\S]*?<!-- std:end ${PR_BLOCK} -->`);

export function codeownersTemplate() {
  const text = readFileSync(join(T, '.github/CODEOWNERS'), 'utf8');
  const start = text.indexOf(BLOCK_BEGIN);
  const end = text.indexOf(BLOCK_END) + BLOCK_END.length;
  return { full: text, block: text.slice(start, end) };
}

// The standard block for one repository: the project files' owner (repoOwner in
// .claude/project.json) goes first, so the standard's own lines still win.
export function codeownersBlock(repoOwner) {
  const { block } = codeownersTemplate();
  if (!repoOwner) return block;
  const lines = block.split('\n');
  const at = lines.findIndex((l) => l !== '' && !l.startsWith('#'));
  const own = ['/CLAUDE.md', ...GUARD_FILES.map((g) => g.codeowners)].map((p) => `${p.padEnd(26)}${repoOwner}`);
  return [...lines.slice(0, at), '# Project files and guard files (they change what allowed commands run): owner from', '# .claude/project.json "repoOwner". Review them with extra care (standard doc 04).', ...own, ...lines.slice(at)].join('\n');
}

// The standard's CODEOWNERS block must name a real team before any repository adopts.
export function codeownersPlaceholders() {
  return [...new Set(codeownersTemplate().block.match(/@<[^>\s]+>(\/<[^>\s]+>)?/g) || [])];
}

export function findBlock(text) {
  const a = text.indexOf(BLOCK_BEGIN);
  const b = text.indexOf(BLOCK_END);
  return a > -1 && b > a ? { start: a, end: b + BLOCK_END.length } : null;
}

// CLAUDE.md for a repository without one; its std blocks are filled by compose.mjs.
export const claudeSkeleton = () => readFileSync(join(T, 'CLAUDE.md'), 'utf8');

// True when CLAUDE.md has no project content yet: outside its std blocks it is still
// the skeleton (a new, empty or freshly scaffolded repository).
export function isUnfilledClaude(text) {
  const outside = (t) => applyBlocks(t.replace(/\r\n/g, '\n'), Object.fromEntries(BLOCK_NAMES.map((n) => [n, '']))).trim();
  return outside(text) === outside(claudeSkeleton());
}

// Command names that adoption pre-fills from package.json scripts.
export const COMMAND_CANDIDATES = {
  build: ['build'],
  lint: ['lint'],
  typecheck: ['typecheck', 'type-check', 'check-types', 'tsc', 'types'],
  'unit-test': ['test:unit', 'test'],
  'integration-test': ['test:int', 'test:integration', 'test:e2e:db', 'integration'],
  'migration-show': ['migration:show', 'typeorm:migration:show', 'db:migrate:status'],
  'migration-generate': ['migration:generate', 'typeorm:migration:generate', 'migrate:create'],
  'migration-run': ['migration:run', 'typeorm:migration:run', 'db:migrate', 'migrate'],
  'migration-revert': ['migration:revert', 'typeorm:migration:revert', 'db:rollback', 'migrate:down']
};
