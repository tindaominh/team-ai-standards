#!/usr/bin/env node
// Smoke test for the adoption kit (scripts/adopt.mjs, .claude/std/compose-settings.mjs),
// scripts/sync-standard.mjs, and the scripts and hooks shipped in templates/.
// Works only in temporary directories.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OPTIONS, canonicalFlags, helpText, optionsTable, parseArgs } from './lib/adopt-options.mjs';
import { applyWrites } from './lib/apply-writes.mjs';
import { standardRelease } from './lib/git.mjs';
import { formatChain, resolveChain, splitCommands } from './lib/script-chain.mjs';
import { GUARD_FILES, codeownersBlock } from './lib/standard.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const T = join(ROOT, 'templates');
const work = mkdtempSync(join(tmpdir(), 'standard-smoke-'));
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures += 1;
}
let skipped = 0;
function skip(name, reason) {
  console.log(`SKIP  ${name} (${reason})`);
  skipped += 1;
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
  // Tests run against temporary copies of the standard (fixtures), never against
  // assumptions about the live templates, which are expected to change:
  //   STD              owners set (filled in only if the live file still has a placeholder),
  //                    plus synthetic "unsupported" dependencies in the registry;
  //   STD_PLACEHOLDER  same, but the CODEOWNERS block has placeholder owners.
  const PLACEHOLDER_RE = /@<[^>\s]+>(\/<[^>\s]+>)?/;
  const BLOCK_RE = /# BEGIN team-ai-standard[\s\S]*?# END team-ai-standard/;
  const blockOf = (text) => (BLOCK_RE.exec(text) || [''])[0];
  const copyStandard = (dir) => {
    cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
    cpSync(T, join(dir, 'templates'), { recursive: true });
    cpSync(join(ROOT, 'package.json'), join(dir, 'package.json'));
    return dir;
  };
  const setOwners = (dir, owner) => {
    const file = join(dir, 'templates/.github/CODEOWNERS');
    const text = readFileSync(file, 'utf8');
    const block = blockOf(text);
    writeFileSync(file, text.replace(block, block.replace(/@\S+/g, owner)));
  };
  const FIXTURE_UNSUPPORTED = { 'fixture-web-framework': 'framework', 'fixture-orm': 'dataAccess', 'fixture-late-framework': 'framework' };
  const STD = copyStandard(join(work, 'standard'));
  if (PLACEHOLDER_RE.test(blockOf(readFileSync(join(T, '.github/CODEOWNERS'), 'utf8')))) setOwners(STD, '@fixture-org/ai-standard-owners');
  const regPath = join(STD, 'templates/fragments/fragments.json');
  const fixtureRegistry = JSON.parse(readFileSync(regPath, 'utf8'));
  fixtureRegistry.unsupported = { ...fixtureRegistry.unsupported, ...FIXTURE_UNSUPPORTED };
  writeFileSync(regPath, `${JSON.stringify(fixtureRegistry, null, 2)}\n`);
  // adopt --yes and sync run only from a released checkout: commit the fixture and tag it.
  const STD_VERSION = readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim();
  const gitStd = (dir, ...a) => execFileSync('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.com', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'init.defaultBranch=main', ...a], { cwd: dir, encoding: 'utf8' });
  const release = (dir, tag = `v${STD_VERSION}`) => {
    gitStd(dir, 'init', '-q');
    gitStd(dir, 'add', '-A');
    gitStd(dir, 'commit', '-q', '-m', 'release');
    gitStd(dir, 'tag', tag);
    return dir;
  };
  release(STD);
  const STD_PLACEHOLDER = copyStandard(join(work, 'standard-placeholder'));
  setOwners(STD_PLACEHOLDER, '@<org>/<ai-standard-owners>');
  const ADOPT = join(STD, 'scripts/adopt.mjs');
  const SYNC = join(STD, 'scripts/sync-standard.mjs');
  const valuesOf = (dim) => Object.keys(fixtureRegistry.dimensions[dim].values).join('|');
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
  // --yes writes only in a git repository on a clean branch: a fixture that is not a git
  // repository yet becomes one (its files committed, on a branch) before its first --yes.
  // Tests of the git refusals call adoptRaw.
  const adoptRaw = (dir, ...a) => run('node', [ADOPT, ...a], { cwd: dir });
  const adopt = (dir, ...a) => {
    if (a.includes('--yes') && !existsSync(join(dir, '.git'))) gitRepo(dir);
    return adoptRaw(dir, ...a);
  };
  // Review, then apply exactly the reviewed plan. A fresh repository needs the CODEOWNERS project owner.
  const OWNER = ['--repo-owner', '@fixture-org/svc-team'];
  const apply = (dir, ...a) => {
    const flags = a.includes('--repo-owner') ? a : [...a, ...OWNER];
    const dry = adopt(dir, ...flags, '--dry-run');
    return dry.status === 0 ? adopt(dir, ...flags, '--yes') : dry;
  };
  const gitIn = (dir, ...a) => execFileSync('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.com', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...a], { cwd: dir, encoding: 'utf8' });
  const gitRepo = (dir, branch = 'chore/adopt') => {
    gitIn(dir, 'init', '-q');
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '-q', '--allow-empty', '-m', 'base');
    if (branch) gitIn(dir, 'switch', '-q', '-c', branch);
    return dir;
  };
  const withoutBlocks = (text) => text.replace(/<!-- std:begin ([a-z-]+) -->[\s\S]*?<!-- std:end \1 -->\n\n?/g, '');
  const compose = (dir, ...a) => run('node', ['.claude/std/compose-settings.mjs', ...a], { cwd: dir });
  const sha = (dir, p) => createHash('sha256').update(readFileSync(join(dir, p))).digest('hex');
  const stackOf = (dir) => JSON.parse(readFileSync(join(dir, '.claude/project.json'), 'utf8')).stack;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const nestScripts = { build: 'nest build', lint: 'eslint .', test: 'jest', 'test:int': 'jest -c int.json', 'migration:run': 'typeorm migration:run' };
  const nestDeps = ['@nestjs/core', 'mysql2', 'typeorm', '@nestjs/typeorm'];

  // 2a. the standard refuses to be adopted or synced while CODEOWNERS has placeholders
  const refused = run('node', [join(STD_PLACEHOLDER, 'scripts/adopt.mjs'), '--stack', 'nestjs-mysql'], { cwd: newRepo('refused') });
  check('adopt: refuses while the CODEOWNERS block has placeholder owners', refused.status === 2 && refused.stderr.includes('placeholder owners'), refused.stderr);
  check('adopt: refusal writes nothing', listFiles(join(work, 'refused')).length === 0);

  // 2b. detection is shown in a dry run and never applied silently
  const det = newRepo('detect-nest', { 'package.json': pkg(nestDeps, nestScripts), 'package-lock.json': '{}' });
  const dryBefore = listFiles(det);
  const dry = adopt(det, '--dry-run');
  check('adopt --dry-run: shows the detected selection and a plan hash', dry.status === 0 && /framework\s+nestjs\s+detected/.test(dry.stdout) && dry.stdout.includes('Plan:') && /Plan hash: [0-9a-f]{16}/.test(dry.stdout), dry.stdout + dry.stderr);
  check('adopt --dry-run: writes nothing', same(listFiles(det), dryBefore));
  check('adopt --dry-run: missing --repo-owner is a required decision', dry.stdout.includes('Decisions required') && dry.stdout.includes('--repo-owner'));
  const ownerMissing = adopt(det, '--yes');
  check('adopt --yes: stops while --repo-owner is missing', ownerMissing.status === 3 && ownerMissing.stderr.includes('decision(s) required'), ownerMissing.stderr);
  check('adopt --yes: refusal writes nothing', same(listFiles(det), dryBefore));
  const noConfirm = adopt(det);
  check('adopt: a real run needs --dry-run then --yes', noConfirm.status === 3 && noConfirm.stderr.includes('--dry-run') && noConfirm.stderr.includes('--framework nestjs'), noConfirm.stderr);
  check('adopt: unconfirmed run writes nothing', same(listFiles(det), dryBefore));
  const noPlan = adopt(newRepo('no-plan', { 'package.json': pkg(nestDeps) }), ...OWNER, '--yes');
  check('adopt --yes: refuses without a reviewed plan', noPlan.status === 3 && noPlan.stderr.includes('no reviewed plan'), noPlan.stderr);
  const yes = apply(det, '--profile', 'standard');
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
    const r = apply(dir);
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
    ['framework dependency', pkg(['fixture-web-framework', 'pg']), 'fixture-web-framework: no framework fragment exists', `--framework ${valuesOf('framework')}`],
    ['data-access dependency next to a driver', pkg(['express', 'fixture-orm', 'pg']), 'fixture-orm: no data-access fragment exists', `--data-access ${valuesOf('dataAccess')}`]
  ];
  unsupportedCases.forEach(([label, p, msg, flag], i) => {
    const dir = newRepo(`unsupported-${i}`, { 'package.json': p });
    const r = adopt(dir, '--dry-run');
    check(`unsupported ${label}: stops with exit 3`, r.status === 3, r.stderr);
    check(`unsupported ${label}: message names the dependency, the missing fragment, doc 11 and the flag`, r.stderr.includes(msg) && r.stderr.includes('11-adding-a-stack-fragment') && r.stderr.includes(flag), r.stderr);
    check(`unsupported ${label}: writes nothing`, listFiles(dir).length === 1);
  });
  const ack = newRepo('unsupported-ack', { 'package.json': pkg(['fixture-web-framework', 'pg', 'typeorm']) });
  const ackRun = apply(ack, '--framework', 'none');
  check('unsupported: explicit flag lets adoption continue', ackRun.status === 0 && stackOf(ack).framework === 'none', ackRun.stderr);
  check('unsupported: explicit override recorded as acknowledged', same(JSON.parse(readFileSync(join(ack, '.claude/project.json'), 'utf8')).acknowledgedUnsupported, ['fixture-web-framework']));
  check('unsupported: std-check does not warn for an acknowledged dependency', !compose(ack, '--check').stdout.includes('depends on fixture-web-framework'));
  const ackPkg = JSON.parse(readFileSync(join(ack, 'package.json'), 'utf8'));
  ackPkg.dependencies['fixture-late-framework'] = '1.0.0';
  writeFileSync(join(ack, 'package.json'), JSON.stringify(ackPkg));
  const ackCheck = compose(ack, '--check');
  check('unsupported: std-check warns for a newly added dependency', ackCheck.stdout.includes('depends on fixture-late-framework') && !ackCheck.stdout.includes('depends on fixture-web-framework'), ackCheck.stdout);
  const ackSync = run('node', [SYNC, '--target', ack]);
  check('unsupported: sync warns for the new dependency only', ackSync.status === 0 && ackSync.stdout.includes('`fixture-late-framework` has no framework fragment') && !ackSync.stdout.includes('`fixture-web-framework`'), ackSync.stdout + ackSync.stderr);
  const removedValue = adopt(newRepo('removed-value'), '--framework', 'fixture-not-a-framework', '--data-access', 'none', '--without-optional');
  check('values outside the registry are rejected', removedValue.status === 2 && removedValue.stderr.includes(`framework must be one of: ${valuesOf('framework').split('|').join(', ')}`), removedValue.stderr);

  // 2e. aliases expand to the composable selection
  // Expected expansions come from the registry; node-postgres is also checked against its documented meaning.
  check('alias node-postgres: documented meaning (framework none + PostgreSQL + TypeORM + AWS)', same(fixtureRegistry.aliases['node-postgres'], { framework: 'none', databases: ['postgres'], dataAccess: 'typeorm', optional: ['aws'] }));
  for (const [alias, expected] of Object.entries(fixtureRegistry.aliases)) {
    const dir = newRepo(`alias-${alias}`);
    const r = apply(dir, '--stack', alias);
    check(`alias ${alias}: applies`, r.status === 0, r.stderr);
    check(`alias ${alias}: expands to the selection`, same(stackOf(dir), { runtime: 'node', ...expected }));
    const frag = (n) => existsSync(join(dir, `.claude/rules/std/fragments/${n}.md`));
    const hasRule = (dim, value) => !existsSync(join(STD, 'templates/fragments', fixtureRegistry.dimensions[dim].folder, value, 'rule.md')) || frag(`${fixtureRegistry.dimensions[dim].folder}-${value}`);
    check(`alias ${alias}: fragment rules installed`, hasRule('framework', expected.framework) && expected.databases.every((d) => hasRule('databases', d)) && hasRule('dataAccess', expected.dataAccess) && expected.optional.every((o) => hasRule('optional', o)));
    const mig = readFileSync(join(dir, `.claude/skills/std-db-migration-review/data-access-${expected.dataAccess}.md`), 'utf8');
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

  // 2g. existing files are merged, never overwritten: CLAUDE.md gets std blocks,
  //     settings.json is regenerated with the repository's stricter rules moved
  //     into project.json, the PR template and CODEOWNERS get an appended block.
  const claudeOriginal = '# Mine\n\nWhat this service does.\n\n## Commands\n\nRun `make test`.\n\n## Architecture\n\nAdapters in src/channels.\n';
  const existing = {
    'package.json': pkg(nestDeps, nestScripts),
    'CLAUDE.md': claudeOriginal,
    '.claude/settings.json': `${JSON.stringify({ permissions: { allow: ['Bash(git push *)', 'Bash(make test *)'], ask: ['Bash(docker *)'], deny: ['Bash(rm -rf *)'] } })}\n`,
    '.github/pull_request_template.md': '## Mine\n\n## Checklist\n\n- [ ] Our own item\n',
    '.github/CODEOWNERS': '* @org/team\n'
  };
  const old = gitRepo(newRepo('existing', existing));
  const oFlags = ['--stack', 'nestjs-mysql', '--carry-allow', 'Bash(make test *)'];
  const oDry = adopt(old, ...oFlags, '--dry-run');
  check('adopt existing repo: dry run passes', oDry.status === 0, oDry.stderr);
  check('adopt existing repo: dry run prints a unified diff of CLAUDE.md', oDry.stdout.includes('--- a/CLAUDE.md') && oDry.stdout.includes('+<!-- std:begin commands -->'));
  check('adopt existing repo: dry run prints the settings.json diff and project.json', oDry.stdout.includes('--- a/.claude/settings.json') && oDry.stdout.includes('+++ b/.claude/project.json'));
  check('adopt existing repo: dry run deletes no CLAUDE.md line', !/^-(?!--)/m.test(oDry.stdout.split('--- a/CLAUDE.md')[1].split('\n--- ')[0]));
  check('adopt existing repo: duplicate "Commands" section reported, not removed', oDry.stdout.includes('"## Commands" may repeat the std "commands" block'));
  check('adopt existing repo: project deny carried over', /carried\s+deny\s+Bash\(rm -rf \*\)/.test(oDry.stdout));
  check('adopt existing repo: allow conflicting with a profile deny dropped and reported', /dropped\s+allow\s+Bash\(git push \*\)\s+\(conflicts with the profile deny/.test(oDry.stdout));
  check('adopt existing repo: no CODEOWNERS owner needed for an existing file', !oDry.stdout.includes('Decisions required'));
  const oHash = /Plan hash: ([0-9a-f]{16})/.exec(oDry.stdout)[1];

  writeFileSync(join(old, 'CLAUDE.md'), `${claudeOriginal}\nEdited after the review.\n`);
  gitIn(old, 'commit', '-q', '-am', 'edit after review');
  const mismatch = adopt(old, ...oFlags, '--yes');
  check('adopt --yes: plan hash mismatch after editing CLAUDE.md stops', mismatch.status === 3 && mismatch.stderr.includes('the plan changed since it was reviewed') && mismatch.stderr.includes('--dry-run'), mismatch.stderr);
  check('adopt --yes: mismatch writes nothing', !existsSync(join(old, '.claude/project.json')));
  gitIn(old, 'reset', '-q', '--hard', 'HEAD~1');
  check('adopt --plan: a hash other than the current plan is refused', adopt(old, ...oFlags, '--plan', 'ffffffffffffffff', '--yes').stderr.includes('reviewed ffffffffffffffff'));

  writeFileSync(join(old, 'scratch.txt'), 'uncommitted\n');
  const dirty = adopt(old, ...oFlags, '--plan', oHash, '--yes');
  check('adopt --yes: dirty working tree refused with the commands to fix it', dirty.status === 3 && dirty.stdout.includes('working tree is not clean') && dirty.stdout.includes('git stash push -u'), dirty.stdout + dirty.stderr);
  rmSync(join(old, 'scratch.txt'));
  gitIn(old, 'switch', '-q', 'main');
  const onMain = adopt(old, ...oFlags, '--plan', oHash, '--yes');
  check('adopt --yes: default branch refused with the command to fix it', onMain.status === 3 && onMain.stdout.includes('is the default branch') && onMain.stdout.includes('git switch -c chore/adopt-ai-standard'), onMain.stdout + onMain.stderr);
  check('adopt --yes: git refusals write nothing', !existsSync(join(old, '.claude/project.json')));
  gitIn(old, 'switch', '-q', 'chore/adopt');

  const oYes = adopt(old, ...oFlags, '--plan', oHash, '--yes');
  check('adopt existing repo: --yes applies the reviewed plan', oYes.status === 0, oYes.stdout + oYes.stderr);
  const claudeAfter = readFileSync(join(old, 'CLAUDE.md'), 'utf8');
  check('adopt existing repo: CLAUDE.md keeps every original line', withoutBlocks(claudeAfter) === claudeOriginal, claudeAfter);
  check('adopt existing repo: std blocks inserted after the intro', claudeAfter.indexOf('<!-- std:begin standard -->') > claudeAfter.indexOf('What this service does.') && claudeAfter.indexOf('<!-- std:end commands -->') < claudeAfter.indexOf('## Commands\n\nRun'));
  const oProject = JSON.parse(readFileSync(join(old, '.claude/project.json'), 'utf8'));
  const oSettings = JSON.parse(readFileSync(join(old, '.claude/settings.json'), 'utf8'));
  check('adopt existing repo: project deny moved to project.json and kept in settings', same(oProject.permissions.deny, ['Bash(rm -rf *)']) && oSettings.permissions.deny.includes('Bash(rm -rf *)'));
  check('adopt existing repo: confirmed allow carried, conflicting allow dropped', same(oProject.permissions.allow, ['Bash(make test *)']) && !oSettings.permissions.allow.includes('Bash(git push *)'));
  const prAfter = readFileSync(join(old, '.github/pull_request_template.md'), 'utf8');
  check('adopt existing repo: PR template keeps its text and gets the standard block', prAfter.startsWith(existing['.github/pull_request_template.md']) && prAfter.includes('<!-- std:begin pr-template -->'));
  const expectedBlock = blockOf(readFileSync(join(STD, 'templates/.github/CODEOWNERS'), 'utf8'));
  const coAfter = readFileSync(join(old, '.github/CODEOWNERS'), 'utf8');
  check('adopt existing repo: CODEOWNERS keeps its text and appends the current block', coAfter.startsWith('* @org/team\n') && expectedBlock.length > 0 && coAfter.trimEnd().endsWith(expectedBlock));
  check('adopt existing repo: no *.proposed files or checklist', !listFiles(old).some((f) => f.endsWith('.proposed') || f.endsWith('std-adoption-checklist.md')));
  check('adopt existing repo: std-check passes', compose(old, '--check').status === 0, compose(old, '--check').stderr);
  gitIn(old, 'add', '-A');
  gitIn(old, 'commit', '-q', '-m', 'adopt');
  const twice = adopt(old, ...oFlags, '--plan', oHash, '--yes');
  check('adopt: second --yes changes nothing', twice.status === 0 && twice.stdout.includes('Nothing to do') && gitIn(old, 'status', '--porcelain') === '');
  check('adopt: --dry-run after --yes reports nothing to do', adopt(old, ...oFlags, '--dry-run').stdout.includes('Nothing to do'));

  // A later update touches only the std blocks of merged files
  const prPath = join(old, '.github/pull_request_template.md');
  const prAdopted = readFileSync(prPath, 'utf8');
  writeFileSync(prPath, `${prAdopted.replace('## Test evidence', '## Test evidence (older release)')}\nTeam note after the block.\n`);
  const claudeBeforeSync = readFileSync(join(old, 'CLAUDE.md'), 'utf8');
  const oSync = run('node', [SYNC, '--target', old]);
  check('sync after merge: PR template block refreshed, text outside it kept', oSync.status === 0 && readFileSync(prPath, 'utf8') === `${prAdopted}\nTeam note after the block.\n`, oSync.stdout + oSync.stderr);
  check('sync after merge: CLAUDE.md unchanged when its blocks are current', readFileSync(join(old, 'CLAUDE.md'), 'utf8') === claudeBeforeSync);
  check('sync after merge: std-check passes', compose(old, '--check').status === 0);

  // An allow rule the profile does not grant needs a human decision
  const allowRepo = gitRepo(newRepo('existing-allow', { 'package.json': pkg(nestDeps), '.claude/settings.json': '{"permissions":{"allow":["Bash(make *)"]}}\n', '.github/CODEOWNERS': '* @org/team\n' }));
  const allowDry = adopt(allowRepo, '--stack', 'nestjs-mysql', '--dry-run');
  check('adopt: existing allow not in the profile is a required decision', allowDry.stdout.includes('allows what the profile does not: Bash(make *)') && allowDry.stdout.includes('--carry-allow'));
  check('adopt --yes: refuses until the allow decision is made', adopt(allowRepo, '--stack', 'nestjs-mysql', '--yes').status === 3 && !existsSync(join(allowRepo, '.claude/project.json')));

  check('adopt: a bare --carry-allow (0.5 form) needs a rule', adopt(allowRepo, '--stack', 'nestjs-mysql', '--carry-allow', '--dry-run').stderr.includes('--carry-allow needs a value: <rule>'));

  // Bare and wildcard forms: "Bash(cmd *)" also matches the bare command (Claude Code
  // permissions docs), so a bare allow the profile already grants is covered.
  const pnpmScripts = { build: 'nest build', lint: 'eslint .', test: 'jest', 'migration:run': 'typeorm migration:run' };
  const bareAllow = ['Bash(pnpm test)', 'Bash(pnpm build)', 'Bash(git status)', 'Bash(git diff)', 'Bash(pnpm test *)'];
  const bareRepo = gitRepo(newRepo('existing-bare', { 'package.json': pkg(nestDeps, pnpmScripts), 'pnpm-lock.yaml': '', '.claude/settings.json': `${JSON.stringify({ permissions: { allow: bareAllow } })}\n`, '.github/CODEOWNERS': '* @org/team\n' }));
  const bareDry = adopt(bareRepo, '--stack', 'nestjs-mysql', '--dry-run');
  check('adopt: bare forms of allowed commands are covered by "cmd *"', bareDry.status === 0 && bareAllow.every((r) => new RegExp(`covered\\s+${r.replace(/[()*]/g, '\\$&')}`).test(bareDry.stdout)) && !bareDry.stdout.includes('Decisions required'), bareDry.stdout + bareDry.stderr);
  const bareYes = adopt(bareRepo, '--stack', 'nestjs-mysql', '--yes');
  const bareProject = JSON.parse(readFileSync(join(bareRepo, '.claude/project.json'), 'utf8'));
  const bareSettings = JSON.parse(readFileSync(join(bareRepo, '.claude/settings.json'), 'utf8'));
  check('adopt: covered allows are not stored in project.json', bareYes.status === 0 && same(bareProject.permissions.allow, []), bareYes.stdout + bareYes.stderr);
  check('adopt: generated settings.json starts with $schema', Object.keys(bareSettings)[0] === '$schema' && bareSettings.$schema === 'https://json.schemastore.org/claude-code-settings.json');
  for (const p of ['strict', 'standard']) {
    const base = JSON.parse(readFileSync(join(T, `.claude/std/settings.${p}.json`), 'utf8'));
    check(`profile ${p}: $schema is the first key`, Object.keys(base)[0] === '$schema');
    check(`profile ${p}: dev servers and cdk ask first`, ['Bash(pnpm dev*)', 'Bash(npm run dev*)', 'Bash(cdk *)', 'Bash(pnpm cdk*)'].every((r) => base.permissions.ask.includes(r)));
  }

  // Unsafe: an allow that overlaps a profile ask or deny, including the bare form of
  // an asked command, is never carried, even when requested.
  const unsafeRepo = gitRepo(newRepo('existing-unsafe', { 'package.json': pkg(nestDeps, pnpmScripts), 'pnpm-lock.yaml': '', '.claude/settings.json': `${JSON.stringify({ permissions: { allow: ['Bash(pnpm migration:run)', 'Bash(pnpm *)', 'Bash(pnpm dev)'] } })}\n`, '.github/CODEOWNERS': '* @org/team\n' }));
  const unsafeDry = adopt(unsafeRepo, '--stack', 'nestjs-mysql', '--dry-run');
  check('adopt: bare form of an asked command is unsafe', /unsafe — cannot be carried\s+Bash\(pnpm migration:run\)\s+\(profile asks Bash\(pnpm migration:run \*\)\)/.test(unsafeDry.stdout), unsafeDry.stdout);
  check('adopt: broad allow overlapping a profile ask is unsafe', /unsafe — cannot be carried\s+Bash\(pnpm \*\)/.test(unsafeDry.stdout) && /unsafe — cannot be carried\s+Bash\(pnpm dev\)/.test(unsafeDry.stdout));
  check('adopt: unsafe allows need no decision', unsafeDry.status === 0 && !unsafeDry.stdout.includes('Decisions required'), unsafeDry.stdout);
  const refusedCarry = adopt(unsafeRepo, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(pnpm migration:run)', '--dry-run');
  check('adopt: carrying an unsafe allow is refused', refusedCarry.stdout.includes('allow Bash(pnpm migration:run) cannot be carried: it overlaps the profile ask Bash(pnpm migration:run *)'), refusedCarry.stdout);
  check('adopt --yes: refused carry writes nothing', adopt(unsafeRepo, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(pnpm migration:run)', '--yes').status === 3 && !existsSync(join(unsafeRepo, '.claude/project.json')));

  // Per-rule decisions
  const perRule = gitRepo(newRepo('existing-per-rule', { 'package.json': pkg(nestDeps), '.claude/settings.json': `${JSON.stringify({ permissions: { allow: ['Bash(make test *)', 'Bash(make lint *)', 'Bash(ls *)'] } })}\n`, '.github/CODEOWNERS': '* @org/team\n' }));
  const pr = ['--stack', 'nestjs-mysql', '--carry-allow', 'Bash(make test *)', '--drop-allow', 'Bash(make lint *)'];
  const prDry = adopt(perRule, ...pr, '--dry-run');
  check('adopt: per-rule choices leave only the undecided rule, with a hint', /needs decision\s+Bash\(ls \*\)\s+— read-only/.test(prDry.stdout) && prDry.stdout.includes('allows what the profile does not: Bash(ls *) (read-only)') && !prDry.stdout.includes('allows what the profile does not: Bash(make'), prDry.stdout);
  const prHashCarry = /Plan hash: ([0-9a-f]{16})/.exec(adopt(perRule, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(ls *)', '--drop-allow-rest', '--dry-run').stdout)[1];
  const prHashDrop = /Plan hash: ([0-9a-f]{16})/.exec(adopt(perRule, '--stack', 'nestjs-mysql', '--drop-allow', 'Bash(ls *)', '--drop-allow-rest', '--dry-run').stdout)[1];
  check('adopt: plan hash changes when allow decisions change', prHashCarry !== prHashDrop);
  check('adopt --yes: a plan reviewed with other allow decisions is refused', adopt(perRule, '--stack', 'nestjs-mysql', '--drop-allow', 'Bash(ls *)', '--drop-allow-rest', '--plan', prHashCarry, '--yes').stderr.includes('the plan changed since it was reviewed'));
  check('adopt: a rule both carried and dropped is an error', adopt(perRule, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(ls *)', '--drop-allow', 'Bash(ls *)', '--dry-run').status === 2);
  check('adopt: naming a rule the settings do not have is a decision', adopt(perRule, ...pr, '--carry-allow', 'Bash(make tset *)', '--drop-allow-rest', '--dry-run').stdout.includes('has no allow rule Bash(make tset *) (named with --carry-allow)'));
  const prYes = apply(perRule, ...pr, '--drop-allow-rest', '--repo-owner', '@org/team');
  const prProject = JSON.parse(readFileSync(join(perRule, '.claude/project.json'), 'utf8'));
  const prSettings = JSON.parse(readFileSync(join(perRule, '.claude/settings.json'), 'utf8'));
  check('adopt: per-rule carry recorded in project.json, the rest dropped', prYes.status === 0 && same(prProject.permissions.allow, ['Bash(make test *)']) && prSettings.permissions.allow.includes('Bash(make test *)') && !prSettings.permissions.allow.includes('Bash(ls *)'), prYes.stdout + prYes.stderr);

  // Fallback: a settings file that cannot be parsed is never guessed at
  const broken = gitRepo(newRepo('existing-broken', { 'package.json': pkg(nestDeps), '.claude/settings.json': '{ not json\n', '.github/CODEOWNERS': '* @org/team\n' }));
  const brokenDry = adopt(broken, '--stack', 'nestjs-mysql', '--dry-run');
  check('adopt: unparseable settings.json is a required decision', brokenDry.stdout.includes('.claude/settings.json cannot be parsed'));
  check('adopt --yes: refuses with an unparseable settings.json', adopt(broken, '--stack', 'nestjs-mysql', '--yes').status === 3);
  const fb = apply(broken, '--stack', 'nestjs-mysql', '--propose-unresolved', '--repo-owner', '@org/team');
  check('adopt --propose-unresolved: writes settings.json.proposed and the checklist only then', fb.status === 0 && existsSync(join(broken, '.claude/settings.json.proposed')) && existsSync(join(broken, '.claude/std-adoption-checklist.md')) && readFileSync(join(broken, '.claude/settings.json'), 'utf8') === '{ not json\n', fb.stdout + fb.stderr);

  // 2h. compose: settings, command table, edits, chained commands, hooks
  const app = det;
  const appSettings = JSON.parse(readFileSync(join(app, '.claude/settings.json'), 'utf8'));
  check('compose: placeholders replaced with project commands', appSettings.permissions.allow.includes('Bash(npm run build *)'));
  check('compose: rules for unset commands left out', !JSON.stringify(appSettings).includes('<typecheck-cmd>'));
  check('compose: standard profile lets git commit ask', appSettings.permissions.ask.includes('Bash(git commit *)'));
  check('adopt: CLAUDE.md command list generated', readFileSync(join(app, 'CLAUDE.md'), 'utf8').includes('- `<build-cmd>`: `npm run build`'));
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
  const claudeOutside = withoutBlocks(readFileSync(join(app, 'CLAUDE.md'), 'utf8'));
  const layer23 = ['.claude/project.json', '.claude/rules/local/billing.md', '.claude/settings.local.json'];
  const before23 = layer23.map((p) => sha(app, p));
  const s1 = run('node', [SYNC, '--target', app]);
  check('sync: runs', s1.status === 0, s1.stderr);
  check('sync: Layer 2 and 3 files unchanged byte for byte', same(layer23.map((p) => sha(app, p)), before23));
  check('sync: CLAUDE.md text outside std blocks unchanged byte for byte', withoutBlocks(readFileSync(join(app, 'CLAUDE.md'), 'utf8')) === claudeOutside);
  check('sync: CLAUDE.md std block follows the new selection', readFileSync(join(app, 'CLAUDE.md'), 'utf8').includes('Stack `nestjs + postgres + raw + aws`'));
  check('sync: tampered standard file restored', readFileSync(join(app, '.claude/rules/std/common/git.md'), 'utf8') === original);
  const fragmentFile = (n) => existsSync(join(app, `.claude/rules/std/fragments/${n}.md`));
  check('sync: newly selected fragments added', fragmentFile('database-postgres') && fragmentFile('data-access-raw') && fragmentFile('optional-aws') && existsSync(join(app, '.claude/skills/std-db-migration-review/data-access-raw.md')));
  check('sync: deselected fragments removed', !fragmentFile('database-mysql') && !fragmentFile('data-access-typeorm') && !existsSync(join(app, '.claude/skills/std-tdd-workflow/data-access-typeorm.md')));
  check('sync: version written', readFileSync(join(app, '.claude/STANDARD_VERSION'), 'utf8').trim() === readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim());
  check('sync: summary reports the version change', s1.stdout.includes('0.0.1 →'));
  // Reordering keys in project.json never triggers the mismatch warning
  const reordered = { ...JSON.parse(readFileSync(projPath, 'utf8')) };
  reordered.stack = { optional: ['aws'], dataAccess: 'raw', databases: ['postgres'], framework: 'nestjs', runtime: 'node' };
  writeFileSync(projPath, `${JSON.stringify(Object.fromEntries(Object.keys(reordered).reverse().map((k) => [k, reordered[k]])), null, 2)}\n`);
  check('compose --check: reordered keys give no mismatch warning', !compose(app, '--check').stdout.includes('differs from the installed fragments'));
  const two = newRepo('two-dbs');
  apply(two, '--framework', 'express', '--db', 'mysql,postgres', '--data-access', 'raw', '--with', 'aws');
  const twoProj = join(two, '.claude/project.json');
  const twoText = JSON.parse(readFileSync(twoProj, 'utf8'));
  twoText.stack = { optional: ['aws'], databases: ['postgres', 'mysql'], runtime: 'node', dataAccess: 'raw', framework: 'express' };
  writeFileSync(twoProj, `${JSON.stringify(twoText, null, 2)}\n`);
  check('compose --check: reordered arrays give no mismatch warning', !compose(two, '--check').stdout.includes('differs from the installed fragments'));
  const s2 = run('node', [SYNC, '--target', app]);
  check('sync: second run changes nothing', s2.stdout.includes('### Files updated\n\n- none'));
  // A release that changes the std blocks: simulate an older block in CLAUDE.md
  const claudeText = readFileSync(join(app, 'CLAUDE.md'), 'utf8');
  writeFileSync(join(app, 'CLAUDE.md'), claudeText.replace('Skills use these placeholders.', 'Old wording.'));
  check('std-check: a stale std block fails', compose(app, '--check').stderr.includes('std blocks are stale'));
  const s3 = run('node', [SYNC, '--target', app]);
  check('sync: refreshes only the std blocks in CLAUDE.md', s3.status === 0 && readFileSync(join(app, 'CLAUDE.md'), 'utf8') === claudeText && s3.stdout.includes('`CLAUDE.md` (std blocks only)'), s3.stdout + s3.stderr);
  check('sync: std-check passes after the update', compose(app, '--check').status === 0);
  check('sync: non-adopted repository is refused', run('node', [SYNC, '--target', newRepo('not-adopted')]).status === 1);
  const syncRefused = run('node', [join(STD_PLACEHOLDER, 'scripts/sync-standard.mjs'), '--target', app]);
  check('sync: refuses while the CODEOWNERS block has placeholder owners', syncRefused.status === 2 && syncRefused.stderr.includes('placeholder owners'), syncRefused.stderr);

  // 2l. options: one list drives the parser, --help and the README; stored values are reused
  const help = adopt(newRepo('help'), '--help');
  check('adopt --help: printed from the options list', help.status === 0 && help.stdout.trim() === helpText().trim(), help.stderr);
  check('adopt --help: lists every option with its description', OPTIONS.every((o) => help.stdout.includes(`--${o.name}`) && help.stdout.includes(o.en.replace(/`/g, ''))));
  const unknown = adopt(newRepo('unknown-option'), '--profle', 'strict', '--dry-run');
  check('adopt: unknown option rejected', unknown.status === 2 && unknown.stderr.includes('unknown option "--profle"'), unknown.stderr);
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  check('README: English and Vietnamese option tables match the options list', readme.includes(optionsTable('en')) && readme.includes(optionsTable('vi')));
  const staleReadme = join(work, 'README.md');
  writeFileSync(staleReadme, readme.replace('| `--profile` |', '| `--profiles` |'));
  const stale2 = run('node', [join(ROOT, 'scripts/generate-readme.mjs'), '--check', '--readme', staleReadme]);
  check('README check: a stale table fails with the command to regenerate', stale2.status === 1 && stale2.stderr.includes('npm run docs:readme'), stale2.stderr);
  for (const lang of ['en', 'vi']) {
    const doc12 = readFileSync(join(ROOT, `docs/${lang}/12-new-project.md`), 'utf8');
    const prompts = readdirSync(join(T, 'prompts')).filter((f) => f.endsWith('.md'));
    check(`doc 12 (${lang}): shows every prompt file verbatim`, prompts.length === 5 && prompts.every((f) => doc12.includes(readFileSync(join(T, 'prompts', f), 'utf8').trim())));
  }
  const staleDoc = join(work, 'stale-doc12.md');
  writeFileSync(staleDoc, readFileSync(join(ROOT, 'docs/en/12-new-project.md'), 'utf8').replace('When to use: right after adoption', 'When to use: an old wording'));
  const stale3 = run('node', [join(ROOT, 'scripts/generate-readme.mjs'), '--check', '--prompts-doc', staleDoc]);
  check('doc 12 check: a stale prompt block fails with the command to regenerate', stale3.status === 1 && stale3.stderr.includes('npm run docs:readme'), stale3.stderr);
  check('dry run: value sources for a new repository', /profile\s+strict\s+default/.test(dry.stdout) && /framework\s+nestjs\s+detected/.test(dry.stdout) && /repo-owner\s+\(none\)\s+default/.test(dry.stdout), dry.stdout);

  const reuse = gitRepo(newRepo('reuse', { 'package.json': pkg(nestDeps, nestScripts) }));
  const first = apply(reuse, '--with-docs');
  check('adopt: repoOwner and optionalGroups stored in project.json', first.status === 0 && stackOf(reuse) && JSON.parse(readFileSync(join(reuse, '.claude/project.json'), 'utf8')).repoOwner === OWNER[1] && same(JSON.parse(readFileSync(join(reuse, '.claude/project.json'), 'utf8')).optionalGroups, ['docs']), first.stdout + first.stderr);
  check('adopt: CODEOWNERS standard block names the project owner', readFileSync(join(reuse, '.github/CODEOWNERS'), 'utf8').includes(`/CLAUDE.md                ${OWNER[1]}`));
  gitIn(reuse, 'add', '-A');
  gitIn(reuse, 'commit', '-q', '-m', 'adopt');
  const again = adopt(reuse, '--dry-run');
  check('dry run after adoption: values come from project.json, nothing to do', again.status === 0 && again.stdout.includes('Nothing to do') && /profile\s+strict\s+project\.json/.test(again.stdout) && /framework\s+nestjs\s+project\.json/.test(again.stdout) && /repo-owner\s+@fixture-org\/svc-team\s+project\.json/.test(again.stdout) && /with-docs\s+on\s+project\.json/.test(again.stdout), again.stdout + again.stderr);
  const commandsBefore = JSON.parse(readFileSync(join(reuse, '.claude/project.json'), 'utf8')).commands;
  const override = adopt(reuse, '--profile', 'standard', '--framework', 'express', '--dry-run');
  check('dry run: a flag overrides project.json and says so', /profile\s+standard\s+flag/.test(override.stdout) && /framework\s+express\s+flag/.test(override.stdout) && /databases\s+mysql\s+project\.json/.test(override.stdout), override.stdout);
  check('dry run: the override plan changes project.json and removes the deselected fragment', override.stdout.includes('modify   .claude/project.json') && override.stdout.includes('delete   .claude/rules/std/fragments/framework-nestjs.md') && override.stdout.includes('create   .claude/rules/std/fragments/framework-express.md'), override.stdout);
  const applied = adopt(reuse, '--profile', 'standard', '--framework', 'express', '--yes');
  const reused = JSON.parse(readFileSync(join(reuse, '.claude/project.json'), 'utf8'));
  check('adopt --yes: override stored, other project.json values kept', applied.status === 0 && reused.profile === 'standard' && reused.stack.framework === 'express' && same(reused.commands, commandsBefore) && reused.repoOwner === OWNER[1], applied.stdout + applied.stderr);
  check('adopt --yes: settings follow the overridden profile', JSON.parse(readFileSync(join(reuse, '.claude/settings.json'), 'utf8')).permissions.ask.includes('Bash(git commit *)') && !existsSync(join(reuse, '.claude/rules/std/fragments/framework-nestjs.md')));
  check('adopt --yes: std-check passes after the override', compose(reuse, '--check').status === 0, compose(reuse, '--check').stderr);
  gitIn(reuse, 'add', '-A');
  gitIn(reuse, 'commit', '-q', '-m', 'override');
  check('dry run: the stored override is reused without the flag', /profile\s+standard\s+project\.json/.test(adopt(reuse, '--dry-run').stdout) && adopt(reuse, '--dry-run').stdout.includes('Nothing to do'));

  const coText = readFileSync(join(reuse, '.github/CODEOWNERS'), 'utf8');
  const reusedProject = { ...reused, repoOwner: '@fixture-org/new-team' };
  writeFileSync(join(reuse, '.claude/project.json'), `${JSON.stringify(reusedProject, null, 2)}\n`);
  writeFileSync(join(reuse, '.github/CODEOWNERS'), coText.replace('# ---- Team AI standard block', '/infra/  @fixture-org/ops\n\n# ---- Team AI standard block'));
  const ownerSync = run('node', [SYNC, '--target', reuse]);
  const coSynced = readFileSync(join(reuse, '.github/CODEOWNERS'), 'utf8');
  check('sync: regenerates the CODEOWNERS block from repoOwner in project.json', ownerSync.status === 0 && blockOf(coSynced) === codeownersBlock('@fixture-org/new-team') && coSynced.includes('/infra/  @fixture-org/ops'), ownerSync.stdout + ownerSync.stderr);
  check('sync: keeps the optional groups stored in project.json', existsSync(join(reuse, 'scripts/generate-docs.mjs')) && existsSync(join(reuse, '.github/workflows/docs-check.yml')));

  // 2l. the standard checkout must be a clean release: dry run warns, --yes refuses, the override is printed
  const STD_REL = join(work, 'standard-rel');
  cpSync(STD, STD_REL, { recursive: true });
  const adoptRel = (dir, ...a) => run('node', [join(STD_REL, 'scripts/adopt.mjs'), ...a], { cwd: dir });
  const nestPkg = { 'package.json': pkg(nestDeps, nestScripts) };
  const relClean = adoptRel(newRepo('rel-clean', nestPkg), ...OWNER, '--dry-run');
  check('release: a tagged, clean standard shows its tag and no warning', relClean.status === 0 && relClean.stdout.includes(`Standard checkout: v${STD_VERSION} (`) && !relClean.stdout.includes('not a released version'), relClean.stdout + relClean.stderr);
  const releaseCase = (label, fix) => {
    const dir = newRepo(`rel-${label.replace(/\W+/g, '-')}`, nestPkg);
    const dry = adoptRel(dir, ...OWNER, '--dry-run');
    check(`release (${label}): --dry-run warns and prints the fix`, dry.status === 0 && dry.stdout.includes('not a released version; --yes will refuse') && dry.stdout.includes(fix), dry.stdout + dry.stderr);
    const before = listFiles(dir);
    const yesRel = adoptRel(dir, ...OWNER, '--yes');
    check(`release (${label}): --yes refuses and writes nothing`, yesRel.status === 3 && yesRel.stderr.includes('not a released version') && yesRel.stderr.includes(fix) && same(listFiles(dir), before), yesRel.stderr);
    return dir;
  };
  writeFileSync(join(STD_REL, 'notes.txt'), 'local change\n');
  releaseCase('dirty standard checkout', 'stash push -u');
  const overrideDir = gitRepo(newRepo('rel-override', nestPkg));
  const overDry = adoptRel(overrideDir, ...OWNER, '--allow-unreleased', '--dry-run');
  const overYes = adoptRel(overrideDir, ...OWNER, '--allow-unreleased', '--yes');
  check('release: --allow-unreleased is printed in --dry-run', overDry.status === 0 && overDry.stdout.includes('UNRELEASED STANDARD (--allow-unreleased)') && !overDry.stdout.includes('--yes will refuse'), overDry.stdout);
  check('release: --allow-unreleased lets --yes apply, and says so', overYes.status === 0 && overYes.stdout.includes('UNRELEASED STANDARD (--allow-unreleased): applied from'), overYes.stdout + overYes.stderr);
  const syncRel = (env, ...a) => run('node', [join(STD_REL, 'scripts/sync-standard.mjs'), '--target', overrideDir, ...a], { env: { ...process.env, GITHUB_ACTIONS: env } });
  const syncNo = syncRel('');
  check('release: sync run by hand refuses an unreleased checkout', syncNo.status === 3 && syncNo.stderr.includes('not a released version'), syncNo.stderr);
  const syncOver = syncRel('', '--allow-unreleased');
  check('release: sync --allow-unreleased runs and records it in the summary', syncOver.status === 0 && syncOver.stdout.includes('**Unreleased standard checkout**'), syncOver.stdout + syncOver.stderr);
  const syncCi = syncRel('true');
  check('release: sync in GitHub Actions skips the check', syncCi.status === 0 && !syncCi.stdout.includes('Unreleased'), syncCi.stdout + syncCi.stderr);
  rmSync(join(STD_REL, 'notes.txt'));
  gitStd(STD_REL, 'commit', '-q', '--allow-empty', '-m', 'unreleased work');
  releaseCase('HEAD not on a tag', `no tag v${STD_VERSION} on it`);
  const relPkg = JSON.parse(readFileSync(join(STD_REL, 'package.json'), 'utf8'));
  writeFileSync(join(STD_REL, 'package.json'), `${JSON.stringify({ ...relPkg, version: '9.9.9' }, null, 2)}\n`);
  gitStd(STD_REL, 'commit', '-q', '-am', 'bump without release');
  gitStd(STD_REL, 'tag', '-f', `v${STD_VERSION}`);
  const mismatchDir = releaseCase('tag and version mismatch', `HEAD is tagged v${STD_VERSION}, not v9.9.9`);
  check('release (tag and version mismatch): package.json and STANDARD_VERSION disagree', adoptRel(mismatchDir, ...OWNER, '--dry-run').stdout.includes(`package.json (9.9.9) and templates/.claude/STANDARD_VERSION (${STD_VERSION}) disagree`));

  // 2m. next steps: new or freshly scaffolded repositories get doc 12 and the prompts; existing ones do not
  const newProjectSteps = (out) => ['docs/en/12-new-project.md', 'templates/prompts/01-fill-claude-md.md', 'templates/prompts/02-project-spec.md', 'templates/prompts/03-kickoff-plan.md'].every((p) => out.includes(join(STD, p)));
  const emptyRepo = newRepo('new-empty');
  const pathB = ['--framework', 'nestjs', '--db', 'mysql', '--data-access', 'typeorm', '--without-optional'];
  const emptyYes = apply(emptyRepo, ...pathB);
  check('next steps: empty repository points to doc 12 and prompts 01-03', emptyYes.status === 0 && newProjectSteps(emptyYes.stdout) && !/Fill in \d+ TODO\(adopt\) item\(s\) in CLAUDE\.md \(about/.test(emptyYes.stdout), emptyYes.stdout + emptyYes.stderr);
  check('next steps: prompts are linked, not copied', !existsSync(join(emptyRepo, 'templates')) && !listFiles(emptyRepo).some((f) => f.includes('prompts')));
  const scaffolded = apply(newRepo('new-scaffolded', { ...nestPkg, 'pnpm-lock.yaml': '' }));
  check('next steps: freshly scaffolded repository points to doc 12 and prompts 01-03', scaffolded.status === 0 && newProjectSteps(scaffolded.stdout), scaffolded.stdout + scaffolded.stderr);
  const existingSteps = apply(gitRepo(newRepo('existing-steps', { ...nestPkg, 'CLAUDE.md': '# Orders service\n\nHandles orders.\n\n## Notes\n\n- TODO(adopt): add the runbook link.\n' })));
  check('next steps: existing repository keeps the usual steps', existingSteps.status === 0 && !existingSteps.stdout.includes('12-new-project.md') && existingSteps.stdout.includes('Fill in 1 TODO(adopt) item(s) in CLAUDE.md'), existingSteps.stdout + existingSteps.stderr);

  // 2n. a re-run fills commands that are still null from package.json; set ones are kept
  const emptyProject = JSON.parse(readFileSync(join(emptyRepo, '.claude/project.json'), 'utf8'));
  check('re-run: an empty repository starts with no commands', Object.values(emptyProject.commands).every((v) => v === null));
  writeFileSync(join(emptyRepo, '.claude/project.json'), `${JSON.stringify({ ...emptyProject, commands: { ...emptyProject.commands, lint: 'make lint' } }, null, 2)}\n`);
  compose(emptyRepo);
  writeFileSync(join(emptyRepo, 'package.json'), pkg(nestDeps, nestScripts));
  writeFileSync(join(emptyRepo, 'pnpm-lock.yaml'), '');
  // Doc 12 path b: commit the adoption and the skeleton, then run adopt again on the branch.
  gitIn(emptyRepo, 'add', '-A');
  gitIn(emptyRepo, 'commit', '-q', '-m', 'scaffold');
  const refillDry = adopt(emptyRepo, '--dry-run');
  check('re-run: --dry-run lists the commands filled from package.json', refillDry.status === 0 && refillDry.stdout.includes('Commands filled from package.json') && /build\s+pnpm build\s+← "build"/.test(refillDry.stdout) && !/lint\s+pnpm lint/.test(refillDry.stdout), refillDry.stdout + refillDry.stderr);
  const refillYes = adopt(emptyRepo, '--yes');
  const refilled = JSON.parse(readFileSync(join(emptyRepo, '.claude/project.json'), 'utf8')).commands;
  check('re-run: --yes stores the filled commands and keeps set ones', refillYes.status === 0 && refilled.build === 'pnpm build' && refilled['unit-test'] === 'pnpm test' && refilled.install === 'pnpm install --frozen-lockfile' && refilled.lint === 'make lint', refillYes.stdout + refillYes.stderr + JSON.stringify(refilled));
  check('re-run: the CLAUDE.md commands block and settings follow', readFileSync(join(emptyRepo, 'CLAUDE.md'), 'utf8').includes('`<build-cmd>`: `pnpm build`') && compose(emptyRepo, '--check').status === 0);
  check('re-run: still a new project, so the next steps point to doc 12', newProjectSteps(refillYes.stdout), refillYes.stdout);
  check('re-run: a second re-run has nothing to do', adopt(emptyRepo, '--dry-run').stdout.includes('Nothing to do'));

  // 2j. 0.8.0: package-script chains, hints, guard files, marketplace as an optional fragment
  const flaggedBy = (c) => (/^cdk\b/.test(c) ? { rule: 'Bash(cdk *)', list: 'ask' } : /^npm run deploy/.test(c) ? { rule: 'Bash(npm run deploy*)', list: 'deny' } : null);
  const chainOf = (cmd, scripts) => resolveChain(cmd, scripts, flaggedBy);
  check('script chain: splits on && || ; | & outside quotes', same(splitCommands('a && b || c; d | e & f "x && y"'), ['a', 'b', 'c', 'd', 'e', 'f "x && y"']));
  check('script chain: nested pnpm scripts reach cdk synth', formatChain(chainOf('pnpm verify', { verify: 'pnpm check', check: 'cross-env AWS_PROFILE=dev cdk synth' }).chain) === 'pnpm verify → pnpm check → cdk synth');
  check('script chain: npm run reaches a denied deploy', chainOf('npm run release', { release: 'npm test && npm run deploy:prod', test: 'jest' }).hit.list === 'deny');
  check('script chain: npm runs pre hooks', formatChain(chainOf('npm run build', { prebuild: 'cdk synth', build: 'tsc' }).chain) === 'npm run build → (prebuild) → cdk synth');
  check('script chain: pnpm does not run pre hooks', chainOf('pnpm build', { prebuild: 'cdk synth', build: 'tsc' }).hit === null);
  check('script chain: run-s expands patterns', formatChain(chainOf('yarn all', { all: 'run-s lint:*', 'lint:a': 'eslint .', 'lint:infra': 'cdk synth -q' }).chain) === 'yarn all → run-s lint:* → npm run lint:infra → cdk synth -q');
  const cyc = chainOf('npm run a', { a: 'npm run b', b: 'npm run a && eslint .' });
  check('script chain: a cycle terminates', cyc.hit === null && same(cyc.cycles, ['a']) && same(cyc.leaves, ['eslint .']));
  check('script chain: missing scripts are reported', same(chainOf('npm run a', { a: 'npm run gone' }).missing, ['gone']));
  check('script chain: not a package script', chainOf('make test', {}) === null && chainOf('yarn nope', {}) === null);

  const chainScripts = { verify: 'pnpm check && pnpm test', check: 'cdk synth', test: 'jest', ci: 'pnpm lint && pnpm test', lint: 'eslint .', release: 'pnpm run deploy:prod', 'deploy:prod': 'cdk deploy' };
  const chainAllow = ['Bash(pnpm verify)', 'Bash(pnpm run release *)', 'Bash(pnpm ci)', 'Bash(make test *)', 'Edit(src/**)'];
  const chainRepo = gitRepo(newRepo('existing-chain', { 'package.json': pkg(nestDeps, chainScripts), 'pnpm-lock.yaml': '', '.claude/settings.json': `${JSON.stringify({ permissions: { allow: chainAllow } })}\n`, '.github/CODEOWNERS': '* @org/team\n' }));
  const chainDry = adopt(chainRepo, '--stack', 'nestjs-mysql', '--dry-run');
  check('adopt: an allow whose package script runs an asked command is unsafe, with the chain', chainDry.stdout.includes('Bash(pnpm verify)  (pnpm verify → pnpm check → cdk synth (profile asks Bash(cdk *)))'), chainDry.stdout);
  check('adopt: an allow whose package script runs a denied command is unsafe', /unsafe — cannot be carried\s+Bash\(pnpm run release \*\)\s+\(pnpm run release → pnpm run deploy:prod \(profile denies/.test(chainDry.stdout), chainDry.stdout);
  check('adopt: a safe package script needs a decision, with what it runs as hint', /needs decision\s+Bash\(pnpm ci\)\s+— runs a package script: eslint \., jest/.test(chainDry.stdout), chainDry.stdout);
  check('adopt: every rule that needs a decision has a hint', /needs decision\s+Bash\(make test \*\)\s+— runs repository code/.test(chainDry.stdout), chainDry.stdout);
  check('adopt: a broad Edit allow is unsafe (it overlaps the profile\'s secret and guard-file rules)', /unsafe — cannot be carried\s+Edit\(src\/\*\*\)/.test(chainDry.stdout), chainDry.stdout);
  const chainCarry = adopt(chainRepo, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(pnpm verify)', '--dry-run');
  check('adopt: carrying an allow whose script runs an asked command is refused', chainCarry.stdout.includes('allow Bash(pnpm verify) cannot be carried: it runs cdk synth through pnpm verify → pnpm check (profile asks Bash(cdk *))'), chainCarry.stdout);
  check('adopt: no hint-less rule is printed', !/needs decision\s+\S+\s*$/m.test(chainDry.stdout));

  for (const p of ['strict', 'standard']) {
    const base = JSON.parse(readFileSync(join(T, `.claude/std/settings.${p}.json`), 'utf8'));
    check(`profile ${p}: asks before editing every guard file`, GUARD_FILES.every((g) => base.permissions.ask.includes(`Edit(${g.rule})`)));
    check(`profile ${p}: no Write(...) path rules (Claude Code never consults them)`, !JSON.stringify(base).includes('Write('));
  }
  const guardBlock = codeownersBlock('@org/svc');
  check('CODEOWNERS: guard files belong to the project owner, before the standard lines', GUARD_FILES.every((g) => guardBlock.includes(`${g.codeowners.padEnd(26)}@org/svc`)) && guardBlock.indexOf('/.github/workflows/ ') < guardBlock.indexOf('/.github/workflows/std-check.yml'));

  // Jobs that read secrets must use a GitHub environment (doc 05): one job per "  name:" block.
  for (const file of [...readdirSync(join(T, '.github/workflows')).map((f) => join(T, '.github/workflows', f)), ...readdirSync(join(ROOT, '.github/workflows')).map((f) => join(ROOT, '.github/workflows', f))]) {
    const text = readFileSync(file, 'utf8');
    const jobs = text.slice(text.indexOf('\njobs:')).split(/\n(?= {2}[A-Za-z0-9_-]+:\s*$)/m).slice(1);
    const bad = jobs.filter((j) => /secrets\.(?!GITHUB_TOKEN)/.test(j) && !/\n {4}environment:/.test(j)).map((j) => j.trim().split(':')[0]);
    check(`workflow ${file.slice(ROOT.length)}: jobs that use secrets run in an environment`, bad.length === 0, bad.join(', '));
  }

  // marketplace: optional; repositories that had the common rule keep it until they record a choice
  const mkt = gitRepo(newRepo('marketplace-legacy', { 'package.json': pkg(nestDeps, nestScripts) }));
  apply(mkt, '--stack', 'nestjs-mysql');
  check('marketplace: a new adoption without --with marketplace does not install it', !existsSync(join(mkt, '.claude/rules/std/fragments/optional-marketplace.md')) && !existsSync(join(mkt, '.claude/rules/std/common/marketplace-integration.md')));
  const legacyPath = '.claude/rules/std/common/marketplace-integration.md';
  writeFileSync(join(mkt, legacyPath), '# Marketplace integration (0.7)\n');
  const mktManifest = JSON.parse(readFileSync(join(mkt, '.claude/std/manifest.json'), 'utf8'));
  mktManifest.files[legacyPath] = createHash('sha256').update('# Marketplace integration (0.7)\n').digest('hex');
  writeFileSync(join(mkt, '.claude/std/manifest.json'), `${JSON.stringify(mktManifest, null, 2)}\n`);
  const mktProjectBefore = readFileSync(join(mkt, '.claude/project.json'), 'utf8');
  const mktSync = run('node', [SYNC, '--target', mkt]);
  check('marketplace: sync of a repository that had the common rule keeps it as a fragment', mktSync.status === 0 && existsSync(join(mkt, '.claude/rules/std/fragments/optional-marketplace.md')) && !existsSync(join(mkt, legacyPath)), mktSync.stdout + mktSync.stderr);
  check('marketplace: sync reports the choice to record and leaves project.json alone', mktSync.stdout.includes('`marketplace` is now an optional fragment') && mktSync.stdout.includes('--with aws,marketplace') && readFileSync(join(mkt, '.claude/project.json'), 'utf8') === mktProjectBefore, mktSync.stdout);
  const mktCheck = compose(mkt, '--check');
  check('marketplace: std-check passes after the sync, without a stack warning', mktCheck.status === 0 && !mktCheck.stderr.includes('stack selection'), mktCheck.stdout + mktCheck.stderr);
  gitIn(mkt, 'add', '-A');
  gitIn(mkt, 'commit', '-q', '-m', 'sync');
  const mktDry = adopt(mkt, '--dry-run');
  check('marketplace: an adopt re-run keeps it and names the source', /optional\s+aws, marketplace\s+project\.json \+ marketplace/.test(mktDry.stdout), mktDry.stdout + mktDry.stderr);
  const mktYes = adopt(mkt, '--yes');
  check('marketplace: the re-run records it in project.json', mktYes.status === 0 && same(stackOf(mkt).optional, ['aws', 'marketplace']), mktYes.stdout + mktYes.stderr);
  gitIn(mkt, 'add', '-A');
  gitIn(mkt, 'commit', '-q', '-m', 'record');
  const mktDrop = adopt(mkt, '--with', 'aws', '--dry-run');
  check('marketplace: --with without it removes the fragment', /delete\s+\.claude\/rules\/std\/fragments\/optional-marketplace\.md/.test(mktDrop.stdout), mktDrop.stdout + mktDrop.stderr);

  // GitHub environments: adopt and sync list them, since neither can check the plan or settings
  const envRepo = gitRepo(newRepo('environments', { 'package.json': pkg(nestDeps, nestScripts) }));
  const envDry = adopt(envRepo, '--stack', 'nestjs-mysql', '--with-docs', ...OWNER, '--dry-run');
  check('adopt --with-docs: lists the GitHub environment the workflows need, with the plan note', /GitHub environments \(not checked[^\n]*\n\s+docs-notify\s+\.github\/workflows\/docs-notify\.yml/.test(envDry.stdout) && envDry.stdout.includes('GitHub Free cannot protect environments'), envDry.stdout);
  const envYes = adopt(envRepo, '--stack', 'nestjs-mysql', '--with-docs', ...OWNER, '--yes');
  check('adopt --with-docs --yes: next steps ask to configure the environment', envYes.status === 0 && envYes.stdout.includes('configure their GitHub environments (docs-notify)'), envYes.stdout + envYes.stderr);
  check('adopt without docs: no environment note', !adopt(newRepo('environments-none', { 'package.json': pkg(nestDeps, nestScripts) }), '--stack', 'nestjs-mysql', ...OWNER, '--dry-run').stdout.includes('GitHub environments'));
  const envSync = run('node', [SYNC, '--target', envRepo]);
  check('sync: the update summary asks to check the environments before merging', envSync.status === 0 && envSync.stdout.includes('Workflows reference GitHub environments: `docs-notify`'), envSync.stdout + envSync.stderr);

  // 2o. git state for every write, staged writes with rollback, flag order, unparseable JSON
  const createOnly = () => ({ 'package.json': pkg(nestDeps, nestScripts) });
  const outsideGit = newRepo('git-none', createOnly());
  const outsideDry = adoptRaw(outsideGit, '--stack', 'nestjs-mysql', ...OWNER, '--dry-run');
  check('adopt --dry-run: a create-only plan lists the git fixes under "Before --yes"', outsideDry.status === 0 && outsideDry.stdout.includes('Before --yes (files will be written)') && outsideDry.stdout.includes('not a git repository'), outsideDry.stdout);
  const outsideBefore = listFiles(outsideGit);
  const outsideYes = adoptRaw(outsideGit, '--stack', 'nestjs-mysql', ...OWNER, '--yes');
  check('adopt --yes: a create-only plan outside git is refused', outsideYes.status === 3 && outsideYes.stderr.includes('git is not in a safe state') && same(listFiles(outsideGit), outsideBefore), outsideYes.stdout + outsideYes.stderr);
  const onDefault = gitRepo(newRepo('git-main', createOnly()), null);
  adoptRaw(onDefault, '--stack', 'nestjs-mysql', ...OWNER, '--dry-run');
  const onDefaultYes = adoptRaw(onDefault, '--stack', 'nestjs-mysql', ...OWNER, '--yes');
  check('adopt --yes: a create-only plan on the default branch is refused', onDefaultYes.status === 3 && onDefaultYes.stdout.includes('is the default branch') && !existsSync(join(onDefault, '.claude/project.json')), onDefaultYes.stdout + onDefaultYes.stderr);
  const untracked = gitRepo(newRepo('git-untracked', createOnly()));
  writeFileSync(join(untracked, 'notes.txt'), 'draft\n');
  adoptRaw(untracked, '--stack', 'nestjs-mysql', ...OWNER, '--dry-run');
  const untrackedYes = adoptRaw(untracked, '--stack', 'nestjs-mysql', ...OWNER, '--yes');
  check('adopt --yes: a create-only plan with an untracked file is refused', untrackedYes.status === 3 && untrackedYes.stdout.includes('working tree is not clean') && !existsSync(join(untracked, '.claude/project.json')), untrackedYes.stdout + untrackedYes.stderr);

  // A write that fails halfway: a folder the plan writes into is read-only (root ignores the mode).
  if (process.getuid && process.getuid() === 0) {
    skip('adopt --yes: a failed write rolls back every change and keeps the plan', 'running as root, so a read-only folder does not fail');
    skip('applyWrites: restores created, modified and deleted files after a failed move', 'running as root');
  } else {
    const rb = gitRepo(newRepo('rollback', { ...createOnly(), 'CLAUDE.md': '# Orders\n\nHandles orders.\n', '.github/pull_request_template.md': '## Summary\n', '.claude/rules/std/.keep': '' }));
    const rbFlags = ['--stack', 'nestjs-mysql', ...OWNER];
    const rbDry = adopt(rb, ...rbFlags, '--dry-run');
    const rbBefore = listFiles(rb);
    const rbSha = Object.fromEntries(rbBefore.map((f) => [f, sha(rb, f)]));
    chmodSync(join(rb, '.claude/rules/std'), 0o555);
    const rbYes = adopt(rb, ...rbFlags, '--yes');
    chmodSync(join(rb, '.claude/rules/std'), 0o755);
    const rbAfter = listFiles(rb);
    check('adopt --yes: a failed write exits 1 and says every change was rolled back', rbDry.status === 0 && rbYes.status === 1 && rbYes.stderr.includes('rolled back every change: no file is half-written') && rbYes.stderr.includes('The reviewed plan is kept'), rbYes.stdout + rbYes.stderr);
    check('adopt --yes: after a failed write the repository is byte for byte as before', same(rbAfter, rbBefore) && rbAfter.every((f) => sha(rb, f) === rbSha[f]) && gitIn(rb, 'status', '--porcelain') === '', JSON.stringify(rbAfter));
    const rbAgain = adopt(rb, ...rbFlags, '--yes');
    check('adopt --yes: the reviewed plan is kept, so --yes succeeds once the cause is fixed', rbAgain.status === 0 && rbAgain.stdout.includes(`Applied plan ${/Plan hash: ([0-9a-f]{16})/.exec(rbDry.stdout)[1]}`), rbAgain.stdout + rbAgain.stderr);

    const aw = newRepo('apply-writes', { 'keep.txt': 'old\n', 'gone.txt': 'bye\n', 'locked/.keep': '' });
    chmodSync(join(aw, 'locked'), 0o555);
    const awResult = applyWrites(aw, [
      { path: 'gone.txt', action: 'delete' },
      { path: 'keep.txt', action: 'modify', after: 'new\n' },
      { path: 'locked/x.txt', action: 'create', after: 'x\n' },
      { path: 'new/deep/y.txt', action: 'create', after: 'y\n' }
    ].sort((a, b) => a.path.localeCompare(b.path)));
    chmodSync(join(aw, 'locked'), 0o755);
    check('applyWrites: restores created, modified and deleted files after a failed move', !awResult.ok && awResult.failedPath === 'locked/x.txt' && awResult.restoreFailures.length === 0 && same(listFiles(aw), ['./gone.txt', './keep.txt', './locked/.keep']) && readFileSync(join(aw, 'keep.txt'), 'utf8') === 'old\n' && !existsSync(join(aw, 'new')) && !readdirSync(aw).some((n) => n.startsWith('.std-adopt-')), JSON.stringify(awResult) + JSON.stringify(listFiles(aw)));
  }

  // The plan hash does not depend on the order the flags are typed in.
  const canon = (...a) => JSON.stringify(canonicalFlags(parseArgs(a).opts));
  check('canonicalFlags: repeated options sorted, comma and repeat forms equal', canon('--with', 'aws', '--with', 'marketplace') === canon('--with', 'marketplace,aws') && canon('--carry-allow', 'A', '--carry-allow', 'B') === canon('--carry-allow', 'B', '--carry-allow', 'A'));
  check('canonicalFlags: fixed order, run-only options and --target left out', canon('--profile', 'strict', '--stack', 'nestjs-mysql', '--dry-run') === canon('--yes', '--plan', 'abc', '--target', '.', '--stack', 'nestjs-mysql', '--profile', 'strict'));
  const order = gitRepo(newRepo('flag-order', { 'package.json': pkg(nestDeps), '.claude/settings.json': `${JSON.stringify({ permissions: { allow: ['Bash(make test *)', 'Bash(ls *)'] } })}\n`, '.github/CODEOWNERS': '* @org/team\n' }));
  const orderDry = adopt(order, '--stack', 'nestjs-mysql', '--carry-allow', 'Bash(make test *)', '--carry-allow', 'Bash(ls *)', '--drop-allow-rest', '--dry-run');
  const orderYes = adopt(order, '--drop-allow-rest', '--carry-allow', 'Bash(ls *)', '--carry-allow', 'Bash(make test *)', '--stack', 'nestjs-mysql', '--yes');
  check('adopt --yes: the same flags in another order apply the reviewed plan', orderDry.status === 0 && orderYes.status === 0, orderYes.stdout + orderYes.stderr);

  // JSON files that cannot be parsed stop with their path and exit 2, writing nothing.
  const badPkg = newRepo('bad-package', { 'package.json': '{ "name": ' });
  const badPkgRun = adoptRaw(badPkg, '--stack', 'nestjs-mysql', ...OWNER, '--dry-run');
  check('adopt: an unparseable package.json stops with exit 2 and the path', badPkgRun.status === 2 && badPkgRun.stderr.includes('package.json cannot be parsed (') && same(listFiles(badPkg), ['./package.json']), badPkgRun.stderr);
  const badManifest = apply(newRepo('bad-manifest', createOnly()), '--stack', 'nestjs-mysql');
  const bm = join(work, 'bad-manifest');
  gitIn(bm, 'add', '-A');
  gitIn(bm, 'commit', '-q', '-m', 'adopt');
  writeFileSync(join(bm, '.claude/std/manifest.json'), '{ broken');
  const bmBefore = listFiles(bm);
  const bmRun = adopt(bm, '--dry-run');
  check('adopt: an unparseable manifest stops with exit 2 and the path', badManifest.status === 0 && bmRun.status === 2 && bmRun.stderr.includes('.claude/std/manifest.json cannot be parsed (') && same(listFiles(bm), bmBefore), bmRun.stdout + bmRun.stderr);
  const STD_BAD = copyStandard(join(work, 'standard-bad-settings'));
  if (PLACEHOLDER_RE.test(blockOf(readFileSync(join(T, '.github/CODEOWNERS'), 'utf8')))) setOwners(STD_BAD, '@fixture-org/ai-standard-owners');
  writeFileSync(join(STD_BAD, 'templates/.claude/std/settings.strict.json'), '{ "permissions": ');
  const badSettings = newRepo('bad-profile-settings', createOnly());
  const bsRun = run('node', [join(STD_BAD, 'scripts/adopt.mjs'), '--stack', 'nestjs-mysql', ...OWNER, '--dry-run'], { cwd: badSettings });
  check('adopt: an unparseable settings.<profile>.json stops with exit 2 and the path', bsRun.status === 2 && bsRun.stderr.includes(`${join(STD_BAD, 'templates/.claude/std/settings.strict.json')} cannot be parsed (`) && bsRun.stderr.includes('check out its release tag again') && same(listFiles(badSettings), ['./package.json']), bsRun.stderr);

  // 2k. the real standard (not a fixture) adopts and syncs when its CODEOWNERS names a real owner
  const liveBlock = blockOf(readFileSync(join(T, '.github/CODEOWNERS'), 'utf8'));
  if (PLACEHOLDER_RE.test(liveBlock)) {
    skip('real standard: adopt and sync succeed with a real CODEOWNERS owner', 'templates/.github/CODEOWNERS still has placeholder owners');
  } else {
    const live = gitRepo(newRepo('live-standard'));
    // This checkout is a release only when HEAD carries its tag; while a change is developed it is not.
    const liveFlags = standardRelease(ROOT).problems.length ? ['--allow-unreleased'] : [];
    run('node', [join(ROOT, 'scripts/adopt.mjs'), '--stack', 'nestjs-mysql', ...OWNER, ...liveFlags, '--dry-run'], { cwd: live });
    const liveAdopt = run('node', [join(ROOT, 'scripts/adopt.mjs'), '--stack', 'nestjs-mysql', ...OWNER, ...liveFlags, '--yes'], { cwd: live });
    const liveSync = run('node', [join(ROOT, 'scripts/sync-standard.mjs'), '--target', live, ...liveFlags]);
    const liveCo = readFileSync(join(live, '.github/CODEOWNERS'), 'utf8');
    check('real standard: adopt and sync succeed with a real CODEOWNERS owner', liveAdopt.status === 0 && liveSync.status === 0 && blockOf(liveCo) === codeownersBlock(OWNER[1]), liveAdopt.stderr + liveSync.stderr);
  }

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
console.log(`\nPASS: all smoke checks${skipped ? ` (${skipped} skipped)` : ''}.`);
