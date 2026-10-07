#!/usr/bin/env node
// Smoke test for the adoption kit (scripts/adopt.mjs, .claude/std/compose-settings.mjs),
// scripts/sync-standard.mjs, and the scripts and hooks shipped in templates/.
// Works only in temporary directories.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const T = join(ROOT, 'templates');
const work = mkdtempSync(join(tmpdir(), 'standard-smoke-'));
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures += 1;
}
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

try {
  // 1. generate-docs.mjs
  const gd = join(work, 'gendocs');
  mkdirSync(join(gd, 'config'), { recursive: true });
  mkdirSync(join(gd, 'docs'), { recursive: true });
  writeFileSync(join(gd, 'package.json'), JSON.stringify({ scripts: { test: 'jest', build: 'nest build' }, scriptsInfo: { test: 'Unit tests' } }));
  // config/env.schema.json as written by templates/scripts/export-env-schema.ts (zod v4, io: 'input')
  mkdirSync(join(gd, 'src/config'), { recursive: true });
  const zodSource = "export const envSchema = z.object({ /* fixture */ });\n";
  writeFileSync(join(gd, 'src/config/env.schema.ts'), zodSource);
  const writeEnvJson = (hash) => writeFileSync(join(gd, 'config/env.schema.json'), JSON.stringify({
    type: 'object',
    properties: {
      DB_PASSWORD: { type: 'string', description: 'Database password', 'x-secret': true },
      DB_HOST: { type: 'string', description: 'MySQL host' },
      PORT: { type: 'integer', default: 3000, description: 'HTTP port' }
    },
    required: ['DB_HOST', 'DB_PASSWORD'],
    'x-source': 'src/config/env.schema.ts',
    'x-source-sha256': hash
  }));
  writeEnvJson(createHash('sha256').update(zodSource).digest('hex'));
  const doc = '# Config\n\nIntro.\n\n<!-- BEGIN GENERATED: env-vars -->\nold\n<!-- END GENERATED: env-vars -->\n\n## Commands\n\n<!-- BEGIN GENERATED: commands -->\n<!-- END GENERATED: commands -->\n\nOutro.\n';
  writeFileSync(join(gd, 'docs/config.md'), doc);
  const gen = (...a) => run('node', [join(T, 'scripts/generate-docs.mjs'), ...a], { cwd: gd });
  check('generate-docs: --check fails when stale', gen('--check').status === 1);
  check('generate-docs: generate succeeds', gen().status === 0);
  const once = readFileSync(join(gd, 'docs/config.md'), 'utf8');
  check('generate-docs: --check passes after generate', gen('--check').status === 0);
  gen();
  check('generate-docs: idempotent', readFileSync(join(gd, 'docs/config.md'), 'utf8') === once);
  check('generate-docs: text outside markers kept', once.startsWith('# Config\n\nIntro.\n') && once.endsWith('\nOutro.\n'));
  check('generate-docs: secret has no default value', /`DB_PASSWORD` \| yes \| \(from Secrets Manager \/ SSM\)/.test(once));
  check('generate-docs: default and required from JSON Schema', /`PORT` \| no \| `3000` \| no \| HTTP port/.test(once));
  const lintBin = join(ROOT, 'node_modules/.bin/markdownlint-cli2');
  if (existsSync(lintBin)) {
    const lint = run(lintBin, ['--config', join(ROOT, '.markdownlint-cli2.jsonc'), join(gd, 'docs/config.md')], { cwd: ROOT });
    check('generate-docs: output passes markdownlint', lint.status === 0, lint.stderr || lint.stdout);
  }

  writeFileSync(join(gd, 'src/config/env.schema.ts'), `${zodSource}// changed\n`);
  const stale = gen('--check');
  check('generate-docs: stale env schema export fails with a clear message', stale.status === 1 && stale.stderr.includes('is stale') && stale.stderr.includes('npm run docs:env-schema'), stale.stderr);
  rmSync(join(gd, 'config/env.schema.json'));
  const missing = gen('--check');
  check('generate-docs: missing env schema fails with a clear message', missing.status === 1 && missing.stderr.includes('is missing'), missing.stderr);

  // 2. adopt.mjs, compose-settings.mjs and sync-standard.mjs
  // The standard is copied so that its CODEOWNERS block can name a real team;
  // the real repository still has the placeholder and must refuse to run.
  const STD = join(work, 'standard');
  cpSync(join(ROOT, 'scripts'), join(STD, 'scripts'), { recursive: true });
  cpSync(T, join(STD, 'templates'), { recursive: true });
  const coTemplate = join(STD, 'templates/.github/CODEOWNERS');
  writeFileSync(coTemplate, readFileSync(coTemplate, 'utf8').replaceAll('@<org>/<ai-standard-owners>', '@acme/ai-standard-owners'));
  const ADOPT = join(STD, 'scripts/adopt.mjs');
  const SYNC = join(STD, 'scripts/sync-standard.mjs');
  const newRepo = (name, files = {}) => {
    const dir = join(work, name);
    mkdirSync(dir, { recursive: true });
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(join(dir, p, '..'), { recursive: true });
      writeFileSync(join(dir, p), c);
    }
    return dir;
  };
  const pkg = (deps, scripts = {}) => JSON.stringify({ name: 'svc', scripts, dependencies: Object.fromEntries(deps.map((d) => [d, '1.0.0'])) });
  const listFiles = (dir) => execFileSync('find', ['.', '-type', 'f', '-not', '-path', './.git/*'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const adopt = (dir, ...a) => run('node', [ADOPT, ...a], { cwd: dir });
  const compose = (dir, ...a) => run('node', ['.claude/std/compose-settings.mjs', ...a], { cwd: dir });
  const sha = (dir, p) => createHash('sha256').update(readFileSync(join(dir, p))).digest('hex');
  const stackOf = (dir) => JSON.parse(readFileSync(join(dir, '.claude/project.json'), 'utf8')).stack;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const nestScripts = { build: 'nest build', lint: 'eslint .', test: 'jest', 'test:int': 'jest -c int.json', 'migration:run': 'typeorm migration:run' };
  const nestDeps = ['@nestjs/core', 'mysql2', 'typeorm', '@nestjs/typeorm'];

  // 2a. the standard refuses to be adopted or synced while CODEOWNERS has placeholders
  const refused = run('node', [join(ROOT, 'scripts/adopt.mjs'), '--stack', 'nestjs-mysql'], { cwd: newRepo('refused') });
  check('adopt: refuses while the CODEOWNERS block has placeholder owners', refused.status === 2 && refused.stderr.includes('placeholder owners'), refused.stderr);
  check('adopt: refusal writes nothing', listFiles(join(work, 'refused')).length === 0);

  // 2b. detection is shown in a dry run and never applied silently
  const det = newRepo('detect-nest', { 'package.json': pkg(nestDeps, nestScripts), 'package-lock.json': '{}' });
  const dryBefore = listFiles(det);
  const dry = adopt(det, '--dry-run');
  check('adopt --dry-run: shows the detected selection', dry.status === 0 && /framework\s+nestjs\s+detected/.test(dry.stdout) && dry.stdout.includes('Plan:'), dry.stdout + dry.stderr);
  check('adopt --dry-run: writes nothing', same(listFiles(det), dryBefore));
  const noConfirm = adopt(det);
  check('adopt: detected selection needs --yes or flags', noConfirm.status === 3 && noConfirm.stderr.includes('--yes') && noConfirm.stderr.includes('--framework nestjs'), noConfirm.stderr);
  check('adopt: unconfirmed run writes nothing', same(listFiles(det), dryBefore));
  const yes = adopt(det, '--yes', '--profile', 'standard');
  check('adopt --yes: runs', yes.status === 0, yes.stderr);
  check('adopt: project.json stores the selection', same(stackOf(det), { runtime: 'node', framework: 'nestjs', databases: ['mysql'], dataAccess: 'typeorm', optional: [] }));

  // 2c. detection for each supported dependency set
  const cases = [
    ['express + pg, no ORM', { 'package.json': pkg(['express', 'pg']) }, { framework: 'express', databases: ['postgres'], dataAccess: 'raw', optional: [] }],
    ['no framework + pg + TypeORM', { 'package.json': pkg(['pg', 'typeorm']) }, { framework: 'none', databases: ['postgres'], dataAccess: 'typeorm', optional: [] }],
    ['NestJS + express dependency stays NestJS', { 'package.json': pkg(['@nestjs/core', 'express', 'mysql2', 'typeorm']) }, { framework: 'nestjs', databases: ['mysql'], dataAccess: 'typeorm', optional: [] }],
    ['AWS SDK enables the aws fragment', { 'package.json': pkg(['express', 'mysql2', '@aws-sdk/client-s3']) }, { framework: 'express', databases: ['mysql'], dataAccess: 'raw', optional: ['aws'] }],
    ['infra folder enables the aws fragment', { 'package.json': pkg(['express']), 'infra/main.tf': '' }, { framework: 'express', databases: [], dataAccess: 'none', optional: ['aws'] }],
    ['two databases', { 'package.json': pkg(['express', 'mysql2', 'pg', 'typeorm']) }, { framework: 'express', databases: ['mysql', 'postgres'], dataAccess: 'typeorm', optional: [] }],
    ['empty repository', {}, { framework: 'none', databases: [], dataAccess: 'none', optional: [] }]
  ];
  cases.forEach(([label, files, expected], i) => {
    const dir = newRepo(`detect-${i}`, files);
    const r = adopt(dir, '--yes');
    check(`detect ${label}: runs`, r.status === 0, r.stderr);
    check(`detect ${label}: selection`, r.status === 0 && same(stackOf(dir), { runtime: 'node', ...expected }), r.status === 0 ? JSON.stringify(stackOf(dir)) : '');
    if (label === 'two databases') check('detect two databases: warns', r.stdout.includes('more than one database'));
  });

  // 2d. ambiguous detection stops and prints the options
  const ambiguous = [
    ['ORM without a database driver', pkg(['typeorm']), '--db mysql|postgres']
  ];
  ambiguous.forEach(([label, p, hint], i) => {
    const dir = newRepo(`ambiguous-${i}`, { 'package.json': p });
    const r = adopt(dir, '--dry-run');
    check(`ambiguous ${label}: stops with exit 3`, r.status === 3 && r.stderr.includes('ambiguous') && r.stderr.includes(hint), r.stderr);
    check(`ambiguous ${label}: writes nothing`, listFiles(dir).length === 1);
  });

  // 2d'. dependencies without a fragment stop adoption unless the dimension is explicit
  const unsupportedCases = [
    ['fastify', pkg(['fastify', 'pg']), 'fastify: no framework fragment exists', '--framework nestjs|express|none'],
    ['@prisma/client next to pg', pkg(['express', '@prisma/client', 'pg']), '@prisma/client: no data-access fragment exists', '--data-access typeorm|raw|none']
  ];
  unsupportedCases.forEach(([label, p, msg, flag], i) => {
    const dir = newRepo(`unsupported-${i}`, { 'package.json': p });
    const r = adopt(dir, '--dry-run');
    check(`unsupported ${label}: stops with exit 3`, r.status === 3, r.stderr);
    check(`unsupported ${label}: message names the dependency, the missing fragment, doc 11 and the flag`, r.stderr.includes(msg) && r.stderr.includes('11-adding-a-stack-fragment') && r.stderr.includes(flag), r.stderr);
    check(`unsupported ${label}: writes nothing`, listFiles(dir).length === 1);
  });
  const ack = newRepo('unsupported-ack', { 'package.json': pkg(['fastify', 'pg', 'typeorm']) });
  const ackRun = adopt(ack, '--framework', 'none', '--yes');
  check('unsupported: explicit flag lets adoption continue', ackRun.status === 0 && stackOf(ack).framework === 'none', ackRun.stderr);
  check('unsupported: explicit override recorded as acknowledged', same(JSON.parse(readFileSync(join(ack, '.claude/project.json'), 'utf8')).acknowledgedUnsupported, ['fastify']));
  check('unsupported: std-check does not warn for an acknowledged dependency', !compose(ack, '--check').stdout.includes('depends on fastify'));
  const ackPkg = JSON.parse(readFileSync(join(ack, 'package.json'), 'utf8'));
  ackPkg.dependencies.koa = '2.0.0';
  writeFileSync(join(ack, 'package.json'), JSON.stringify(ackPkg));
  const ackCheck = compose(ack, '--check');
  check('unsupported: std-check warns for a newly added dependency', ackCheck.stdout.includes('depends on koa') && !ackCheck.stdout.includes('depends on fastify'), ackCheck.stdout);
  const ackSync = run('node', [SYNC, '--target', ack]);
  check('unsupported: sync warns for the new dependency only', ackSync.status === 0 && ackSync.stdout.includes('`koa` has no framework fragment') && !ackSync.stdout.includes('`fastify`'), ackSync.stdout + ackSync.stderr);
  const removedValue = adopt(newRepo('removed-value'), '--framework', 'fastify', '--data-access', 'none', '--without-optional');
  check('removed fragment values are rejected', removedValue.status === 2 && removedValue.stderr.includes('framework must be one of: nestjs, express, none'), removedValue.stderr);

  // 2e. aliases expand to the composable selection
  const aliases = {
    'nestjs-mysql': { framework: 'nestjs', databases: ['mysql'], dataAccess: 'typeorm', optional: ['aws'] },
    'nestjs-postgres': { framework: 'nestjs', databases: ['postgres'], dataAccess: 'typeorm', optional: ['aws'] },
    'node-postgres': { framework: 'none', databases: ['postgres'], dataAccess: 'typeorm', optional: ['aws'] }
  };
  for (const [alias, expected] of Object.entries(aliases)) {
    const dir = newRepo(`alias-${alias}`);
    const r = adopt(dir, '--stack', alias);
    check(`alias ${alias}: runs without --yes`, r.status === 0, r.stderr);
    check(`alias ${alias}: expands to the selection`, same(stackOf(dir), { runtime: 'node', ...expected }));
    const frag = (n) => existsSync(join(dir, `.claude/rules/std/fragments/${n}.md`));
    check(`alias ${alias}: fragment rules installed`, frag(`framework-${expected.framework}`) && frag(`database-${expected.databases[0]}`) && frag('data-access-typeorm') && frag('optional-aws'));
    const mig = readFileSync(join(dir, '.claude/skills/std-db-migration-review/data-access-typeorm.md'), 'utf8');
    check(`alias ${alias}: data source type filled`, mig.includes(`type: '${expected.databases[0]}'`) && !/\{\{[A-Z_]+\}\}/.test(mig));
    check(`alias ${alias}: compose --check passes`, compose(dir, '--check').status === 0);
  }

  // 2f. invalid combinations are rejected
  const invalid = [
    ['raw without a database', ['--framework', 'none', '--data-access', 'raw', '--without-optional'], 'needs at least one database'],
    ['unknown framework', ['--framework', 'django', '--data-access', 'none', '--without-optional'], 'framework must be one of'],
    ['database with data access none', ['--framework', 'none', '--db', 'mysql', '--data-access', 'none', '--without-optional'], 'data access is "none"'],
    ['unknown alias', ['--stack', 'rails'], 'unknown --stack alias']
  ];
  invalid.forEach(([label, a, msg], i) => {
    const dir = newRepo(`invalid-${i}`);
    const r = adopt(dir, ...a);
    check(`invalid ${label}: rejected with exit 2`, r.status === 2 && r.stderr.includes(msg), r.stderr);
    check(`invalid ${label}: writes nothing`, listFiles(dir).length === 0);
  });

  // 2g. existing CLAUDE.md, settings, PR template and CODEOWNERS are never overwritten
  const existing = { 'CLAUDE.md': '# Mine\n', '.claude/settings.json': '{"permissions":{"deny":["Bash(rm *)"]}}\n', '.github/pull_request_template.md': '## Mine\n', '.github/CODEOWNERS': '* @org/team\n' };
  const old = newRepo('existing', existing);
  const o1 = adopt(old, '--stack', 'nestjs-mysql');
  check('adopt existing repo: runs', o1.status === 0, o1.stderr);
  for (const [p, c] of Object.entries(existing)) {
    check(`adopt existing repo: ${p} unchanged`, readFileSync(join(old, p), 'utf8') === c);
    check(`adopt existing repo: ${p}.proposed written`, existsSync(join(old, `${p}.proposed`)));
  }
  check('adopt existing repo: merge checklist written', existsSync(join(old, '.claude/std-adoption-checklist.md')));
  const coProposed = readFileSync(join(old, '.github/CODEOWNERS.proposed'), 'utf8');
  check('adopt existing repo: CODEOWNERS proposal keeps original and appends block', coProposed.startsWith('* @org/team') && coProposed.includes('# BEGIN team-ai-standard') && coProposed.includes('@acme/ai-standard-owners'));

  // 2h. compose: settings, command table, edits, chained commands, hooks
  const app = det;
  const appSettings = JSON.parse(readFileSync(join(app, '.claude/settings.json'), 'utf8'));
  check('compose: placeholders replaced with project commands', appSettings.permissions.allow.includes('Bash(npm run build *)'));
  check('compose: rules for unset commands left out', !JSON.stringify(appSettings).includes('<typecheck-cmd>'));
  check('compose: standard profile lets git commit ask', appSettings.permissions.ask.includes('Bash(git commit *)'));
  check('adopt: CLAUDE.md command table generated', readFileSync(join(app, 'CLAUDE.md'), 'utf8').includes('| `<build-cmd>` | Build | `npm run build` |'));
  check('adopt: no unfilled template variables', !listFiles(app).some((f) => /\{\{[A-Z_]+\}\}/.test(readFileSync(join(app, f), 'utf8'))));
  const rule = join(app, '.claude/rules/std/common/git.md');
  const original = readFileSync(rule, 'utf8');
  writeFileSync(rule, `${original}- local edit\n`);
  const edited = compose(app, '--check');
  check('compose --check: edited standard file fails', edited.status === 1 && edited.stderr.includes('edited in this repository'), edited.stderr);
  writeFileSync(rule, original);
  const projPath = join(app, '.claude/project.json');
  const projText = readFileSync(projPath, 'utf8');
  writeFileSync(projPath, projText.replace('"npm run build"', '"npm run build && curl x"'));
  check('compose: chained command rejected', compose(app).status === 1);
  writeFileSync(projPath, projText.replace('"hooks": false', '"hooks": true'));
  compose(app);
  check('compose: hooks enabled only on request', JSON.stringify(JSON.parse(readFileSync(join(app, '.claude/settings.json'), 'utf8')).hooks || {}).includes('std/hooks/typecheck-on-stop.cjs'));
  writeFileSync(projPath, projText);
  compose(app);
  writeFileSync(projPath, projText.replace('"npm run lint"', '"npm run lint:all"'));
  const staleSettings = compose(app, '--check');
  writeFileSync(projPath, projText);
  check('compose --check: stale settings detected', staleSettings.status === 1 && staleSettings.stderr.includes('does not match'));

  // 2i. std-check: committed proposals and personal settings fail
  const gitRun = (...a) => execFileSync('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.com', '-c', 'commit.gpgsign=false', ...a], { cwd: app, encoding: 'utf8' });
  gitRun('init', '-q');
  gitRun('add', '-A');
  check('std-check: clean git checkout passes', compose(app, '--check').status === 0);
  writeFileSync(join(app, 'CLAUDE.md.proposed'), 'x\n');
  writeFileSync(join(app, '.claude/settings.local.json'), '{}\n');
  gitRun('add', '-f', 'CLAUDE.md.proposed', '.claude/settings.local.json');
  const tracked = compose(app, '--check');
  check('std-check: committed *.proposed fails', tracked.status === 1 && tracked.stderr.includes('adoption proposal committed'), tracked.stderr);
  check('std-check: tracked settings.local.json fails', tracked.stderr.includes('personal settings committed'));
  gitRun('rm', '-q', '--cached', 'CLAUDE.md.proposed', '.claude/settings.local.json');
  rmSync(join(app, 'CLAUDE.md.proposed'));
  check('std-check: passes again after removing them from git', compose(app, '--check').status === 0);

  // 2j. sync writes only Layer 1, adds and removes fragments, and flags a table format change
  writeFileSync(join(app, 'CLAUDE.md'), `${readFileSync(join(app, 'CLAUDE.md'), 'utf8')}\nProject note.\n`);
  writeFileSync(join(app, '.claude/rules/local/billing.md'), '# Billing\n- Local rule.\n');
  writeFileSync(join(app, '.claude/rules/std/common/git.md'), 'tampered\n');
  writeFileSync(join(app, '.claude/STANDARD_VERSION'), '0.0.1\n');
  // The team changes its selection (Layer 2): MySQL + TypeORM -> PostgreSQL + raw driver, and adds AWS
  const changed = JSON.parse(projText);
  changed.stack = { runtime: 'node', framework: 'nestjs', databases: ['postgres'], dataAccess: 'raw', optional: ['aws'] };
  writeFileSync(projPath, `${JSON.stringify(changed, null, 2)}\n`);
  check('compose --check: warns when the selection differs from installed fragments', compose(app, '--check').stdout.includes('differs from the installed fragments'));
  const layer23 = ['CLAUDE.md', '.claude/project.json', '.claude/rules/local/billing.md', '.claude/settings.local.json'];
  const before23 = layer23.map((p) => sha(app, p));
  const s1 = run('node', [SYNC, '--target', app]);
  check('sync: runs', s1.status === 0, s1.stderr);
  check('sync: Layer 2 and 3 files unchanged byte for byte', same(layer23.map((p) => sha(app, p)), before23));
  check('sync: tampered standard file restored', readFileSync(join(app, '.claude/rules/std/common/git.md'), 'utf8') === original);
  const fragmentFile = (n) => existsSync(join(app, `.claude/rules/std/fragments/${n}.md`));
  check('sync: newly selected fragments added', fragmentFile('database-postgres') && fragmentFile('data-access-raw') && fragmentFile('optional-aws') && existsSync(join(app, '.claude/skills/std-db-migration-review/data-access-raw.md')));
  check('sync: deselected fragments removed', !fragmentFile('database-mysql') && !fragmentFile('data-access-typeorm') && !existsSync(join(app, '.claude/skills/std-tdd-workflow/data-access-typeorm.md')));
  check('sync: version written', readFileSync(join(app, '.claude/STANDARD_VERSION'), 'utf8').trim() === readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim());
  check('sync: summary reports the version change', s1.stdout.includes('0.0.1 →'));
  check('sync: no table action when the format is unchanged', !s1.stdout.includes('Action required'));
  // Reordering keys in project.json never triggers the mismatch warning
  const reordered = { ...JSON.parse(readFileSync(projPath, 'utf8')) };
  reordered.stack = { optional: ['aws'], dataAccess: 'raw', databases: ['postgres'], framework: 'nestjs', runtime: 'node' };
  writeFileSync(projPath, `${JSON.stringify({ permissions: reordered.permissions, commands: reordered.commands, hooks: reordered.hooks, profile: reordered.profile, stack: reordered.stack }, null, 2)}\n`);
  check('compose --check: reordered keys give no mismatch warning', !compose(app, '--check').stdout.includes('differs from the installed fragments'));
  const two = newRepo('two-dbs');
  adopt(two, '--framework', 'express', '--db', 'mysql,postgres', '--data-access', 'raw', '--with', 'aws');
  const twoProj = join(two, '.claude/project.json');
  const twoText = JSON.parse(readFileSync(twoProj, 'utf8'));
  twoText.stack = { optional: ['aws'], databases: ['postgres', 'mysql'], runtime: 'node', dataAccess: 'raw', framework: 'express' };
  writeFileSync(twoProj, `${JSON.stringify(twoText, null, 2)}\n`);
  check('compose --check: reordered arrays give no mismatch warning', !compose(two, '--check').stdout.includes('differs from the installed fragments'));
  const s2 = run('node', [SYNC, '--target', app]);
  check('sync: second run changes nothing', s2.stdout.includes('### Files updated\n\n- none'));
  // A release that changes the command table format: simulate an old-format table in CLAUDE.md
  const claudeText = readFileSync(join(app, 'CLAUDE.md'), 'utf8');
  writeFileSync(join(app, 'CLAUDE.md'), claudeText.replace('| Placeholder | Purpose | Command |', '| Placeholder | Command (old format) |'));
  const claudeSha = sha(app, 'CLAUDE.md');
  const s3 = run('node', [SYNC, '--target', app]);
  check('sync: table format change gives the exact command', s3.stdout.includes('Action required: regenerate the command table') && s3.stdout.includes('node .claude/std/compose-settings.mjs') && s3.stdout.includes('MAJOR'), s3.stdout);
  check('sync: CLAUDE.md still untouched', sha(app, 'CLAUDE.md') === claudeSha);
  check('sync: non-adopted repository is refused', run('node', [SYNC, '--target', newRepo('not-adopted')]).status === 1);
  check('sync: refuses while the CODEOWNERS block has placeholder owners', run('node', [join(ROOT, 'scripts/sync-standard.mjs'), '--target', app]).status === 2);

  // 3. hooks (run from a directory whose package.json is an ES module)
  const hp = join(work, 'hooks');
  mkdirSync(join(hp, 'src'), { recursive: true });
  writeFileSync(join(hp, 'package.json'), '{"type":"module"}');
  writeFileSync(join(hp, 'src/a.ts'), 'x\n');
  const hook = (file, input) => run('node', [join(T, '.claude/std/hooks', file)], { cwd: hp, input, env: { ...process.env, CLAUDE_PROJECT_DIR: hp } });
  const h1 = hook('format-check-on-edit.cjs', JSON.stringify({ tool_input: { file_path: 'src/a.ts' } }));
  check('hook format-check: exits 0 without prettier, no output', h1.status === 0 && h1.stdout === '', h1.stderr);
  check('hook format-check: file not modified', readFileSync(join(hp, 'src/a.ts'), 'utf8') === 'x\n');
  check('hook format-check: bad input exits 0', hook('format-check-on-edit.cjs', 'garbage').status === 0);
  check('hook typecheck: stop_hook_active exits 0', hook('typecheck-on-stop.cjs', '{"stop_hook_active":true}').status === 0);
  check('hook typecheck: no tsc exits 0', hook('typecheck-on-stop.cjs', '{}').status === 0);

  // 4. check-docs-updated.mjs in a throwaway git repository
  const gr = join(work, 'git');
  mkdirSync(gr);
  const git = (...a) => execFileSync('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.com', '-c', 'commit.gpgsign=false', ...a], { cwd: gr, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(gr, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  mkdirSync(join(gr, '.github/workflows'), { recursive: true });
  writeFileSync(join(gr, '.github/workflows/ci.yml'), 'name: ci\n');
  git('add', '.');
  git('commit', '-q', '-m', 'workflow');
  const head1 = git('rev-parse', 'HEAD').trim();
  const cdu = (head) => run('node', [join(T, 'scripts/check-docs-updated.mjs')], { cwd: gr, env: { ...process.env, BASE_SHA: base, HEAD_SHA: head, HAS_BYPASS_LABEL: 'false', GITHUB_STEP_SUMMARY: '' } });
  check('check-docs-updated: workflow change without docs fails', cdu(head1).status === 1);
  mkdirSync(join(gr, 'docs'));
  writeFileSync(join(gr, 'docs/ci.md'), '# CI\n');
  git('add', '.');
  git('commit', '-q', '-m', 'docs');
  check('check-docs-updated: with docs passes', cdu(git('rev-parse', 'HEAD').trim()).status === 0);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} smoke check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: all smoke checks.');
