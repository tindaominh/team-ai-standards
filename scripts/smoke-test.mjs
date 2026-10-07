#!/usr/bin/env node
// Smoke test for the scripts and hooks shipped in templates/ and for
// scripts/sync-standard.mjs. Works only in temporary directories.
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

  // 2. sync-standard.mjs
  const tgt = join(work, 'target');
  mkdirSync(join(tgt, '.claude'), { recursive: true });
  writeFileSync(join(tgt, 'CLAUDE.md'), '# Repo-owned\n');
  writeFileSync(join(tgt, '.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test *)'], deny: ['Bash(* deploy *)', 'Bash(my-own-rule *)'] } }, null, 2));
  const sync = () => run('node', [join(ROOT, 'scripts/sync-standard.mjs'), '--target', tgt, '--profile', 'strict']);
  const first = sync();
  check('sync-standard: runs', first.status === 0, first.stderr);
  const s = JSON.parse(readFileSync(join(tgt, '.claude/settings.json'), 'utf8'));
  check('sync-standard: allow rules untouched', JSON.stringify(s.permissions.allow) === JSON.stringify(['Bash(npm test *)']));
  check('sync-standard: missing deny rules added', s.permissions.deny.includes('Bash(git push *)'));
  check('sync-standard: existing deny rules kept', s.permissions.deny.includes('Bash(my-own-rule *)'));
  check('sync-standard: CLAUDE.md untouched', readFileSync(join(tgt, 'CLAUDE.md'), 'utf8') === '# Repo-owned\n');
  check('sync-standard: version written', readFileSync(join(tgt, '.claude/STANDARD_VERSION'), 'utf8').trim() === readFileSync(join(T, '.claude/STANDARD_VERSION'), 'utf8').trim());
  check('sync-standard: rules copied', existsSync(join(tgt, '.claude/rules/common/workflow.md')));
  check('sync-standard: removed upstream rule reported', first.stdout.includes('Bash(* deploy *)'));
  check('sync-standard: hooks not added when not opted in', !existsSync(join(tgt, '.claude/hooks')));
  const second = sync();
  check('sync-standard: second run changes nothing', second.stdout.includes('### Files updated\n\n- none'));

  // 3. hooks (run from a directory whose package.json is an ES module)
  const hp = join(work, 'hooks');
  mkdirSync(join(hp, 'src'), { recursive: true });
  writeFileSync(join(hp, 'package.json'), '{"type":"module"}');
  writeFileSync(join(hp, 'src/a.ts'), 'x\n');
  const hook = (file, input) => run('node', [join(T, 'hooks', file)], { cwd: hp, input, env: { ...process.env, CLAUDE_PROJECT_DIR: hp } });
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
