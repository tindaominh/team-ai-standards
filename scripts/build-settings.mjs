#!/usr/bin/env node
// Single source for the two base permission profiles in templates/.claude/std/:
//   settings.strict.json    strict   (default, client repositories)
//   settings.standard.json  standard (internal repositories only)
// In a project repository, .claude/std/compose-settings.mjs combines the chosen
// base profile with .claude/project.json into .claude/settings.json.
// Usage: node scripts/build-settings.mjs           write both files
//        node scripts/build-settings.mjs --check   exit 1 if files are stale
//
// Rule syntax (Claude Code docs, "Configure permissions"):
//   Bash(cmd *)  matches "cmd" and "cmd <anything>"; the space before * is part of the rule.
//   Bash(cmd*)   no space: also matches "cmdX" (used for deploy:prod style scripts).
//   Precedence: deny > ask > allow. Deny rules also apply to subagents.
// Command placeholders such as <unit-test-cmd> are replaced with the commands in
// .claude/project.json; rules whose command is not set are left out.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../templates/.claude/std/', import.meta.url).pathname;
const bash = (cmd) => `Bash(${cmd})`;

const allow = [
  ...['<build-cmd>', '<lint-cmd>', '<typecheck-cmd>', '<unit-test-cmd>', '<integration-test-cmd>',
    '<migration-show-cmd>', 'npm audit'].map((c) => bash(`${c} *`)),
  ...['git status', 'git diff', 'git log', 'git show', 'git blame', 'git rev-parse', 'git merge-base',
    'git ls-files'].map((c) => bash(`${c} *`)),
  bash('git branch --show-current')
];

const ask = [
  ...['npm install', 'npm i', 'npm ci', 'npm uninstall', 'npm update', 'npm exec', 'npx',
    'pnpm add', 'pnpm install', 'yarn add', 'yarn install',
    '<migration-generate-cmd>', '<migration-run-cmd>', '<migration-revert-cmd>',
    'docker', 'curl', 'wget', 'aws', 'gh'].map((c) => bash(`${c} *`)),
  'WebFetch',
  'WebSearch',
  // Long-running processes and commands that use real cloud credentials ask first:
  // in the 0.5.0 pilot, dev servers and cdk diff/synth ran with the developer's AWS
  // profile. No space before * so script variants (dev:api, cdk:diff) match too.
  // Deploy and destroy variants are denied below; deny wins.
  ...['npm run dev', 'npm run start', 'npm start', 'npm run serve', 'npm run watch',
    'pnpm dev', 'pnpm run dev', 'pnpm start', 'pnpm run start', 'pnpm serve', 'pnpm run serve', 'pnpm watch', 'pnpm run watch',
    'yarn dev', 'yarn run dev', 'yarn start', 'yarn run start', 'yarn serve', 'yarn watch',
    'npm run cdk', 'pnpm cdk', 'pnpm run cdk', 'yarn cdk'].map((c) => bash(`${c}*`)),
  ...['next dev', 'nest start', 'vite', 'cdk', 'terraform', 'sam', 'serverless', 'sls', 'pulumi', 'copilot', 'eb']
    .map((c) => bash(`${c} *`))
];

const secretPaths = [
  '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx',
  '**/credentials', '**/credentials.json', '**/secrets/**', '~/.aws/**', '~/.ssh/**',
  '**/*.sql.gz', '**/*dump*.sql', '**/dumps/**', '**/*.dump', '**/prod*.sql'
];

const awsMutatingVerbs = ['create-*', 'delete-*', 'update-*', 'put-*', 'modify-*', 'run-*', 'start-*',
  'stop-*', 'terminate-*', 'register-*', 'deregister-*', 'attach-*', 'detach-*', 'associate-*',
  'disassociate-*', 'tag-*', 'untag-*', 'reboot-*', 'restore-*', 'revoke-*', 'authorize-*',
  'invoke*', 'send-*', 'publish*', 'execute-*', 'set-*', 'enable-*', 'disable-*', 'import-*',
  'copy-*', 'rotate-*', 'reset-*', 'cancel-*', 'remove-*', 'add-*'];

// Explicit deploy and infrastructure-apply commands. "deploy*" without a space
// also matches script variants such as deploy:prod.
const deployCommands = [
  'npm run deploy*', 'pnpm run deploy*', 'pnpm deploy*', 'yarn deploy*', 'yarn run deploy*',
  'cdk deploy*', 'npx cdk deploy*', 'cdk destroy*', 'npx cdk destroy*',
  'serverless deploy*', 'sls deploy*', 'npx serverless deploy*', 'npx sls deploy*',
  'terraform apply*', 'terraform destroy*', 'sam deploy*', 'copilot * deploy*', 'eb deploy*',
  'aws ecs update-service*', 'aws ecs run-task*', 'aws cloudformation deploy*', 'aws deploy *',
  'docker push *'
];

const denyCommon = [
  ...secretPaths.map((p) => `Read(${p})`),
  ...secretPaths.map((p) => `Edit(${p})`),
  bash('env'),
  bash('printenv *'),
  // Secrets and production data through the AWS CLI
  bash('aws configure *'),
  bash('aws secretsmanager get-secret-value *'),
  bash('aws ssm get-parameter *'),
  bash('aws ssm get-parameters *'),
  bash('aws ssm get-parameters-by-path *'),
  bash('aws sts get-session-token *'),
  bash('aws logs *'),
  bash('aws rds-data *'),
  // AWS resource changes
  ...awsMutatingVerbs.map((v) => bash(`aws * ${v}`)),
  ...['cp', 'mv', 'rm', 'sync', 'mb', 'rb'].map((v) => bash(`aws s3 ${v} *`)),
  // Deploys
  ...deployCommands.map(bash),
  // Git history and shared branches
  bash('git push *'),
  bash('git reset --hard *'),
  bash('git rebase *'),
  bash('git merge *'),
  bash('git clean *'),
  bash('git branch -D *'),
  bash('git filter-branch *'),
  bash('git update-ref *'),
  // GitHub actions that belong to humans
  ...['gh pr merge', 'gh pr review', 'gh release', 'gh workflow run', 'gh secret', 'gh variable']
    .map((c) => bash(`${c} *`)),
  // Direct database clients (match only commands that start with these binaries)
  ...['mysql', 'mysqldump', 'psql', 'pg_dump', 'pg_dumpall', 'pg_restore'].map((c) => bash(`${c} *`))
];

const gitWrites = ['git add', 'git commit', 'git checkout', 'git switch', 'git restore', 'git stash',
  'git cherry-pick', 'git revert', 'git rm', 'git mv', 'git branch -d', 'git branch -m', 'git worktree'];
const gitAlwaysDenied = ['git tag', 'git am', 'git apply', 'git init', 'git remote', 'git config',
  'git submodule', 'gh pr create', 'gh pr comment', 'gh pr edit', 'gh pr close', 'gh issue'];

const profile = (extraAsk, extraDeny) => ({
  $schema: 'https://json.schemastore.org/claude-code-settings.json',
  permissions: {
    allow,
    ask: [...ask, ...extraAsk],
    deny: [...denyCommon, ...extraDeny],
    disableBypassPermissionsMode: 'disable'
  },
  enableAllProjectMcpServers: false,
  cleanupPeriodDays: 14
});

const files = {
  'settings.strict.json': profile([], [...gitWrites, ...gitAlwaysDenied].map((c) => bash(`${c} *`))),
  'settings.standard.json': profile(gitWrites.map((c) => bash(`${c} *`)), gitAlwaysDenied.map((c) => bash(`${c} *`)))
};

const check = process.argv.includes('--check');
let stale = 0;
for (const [name, value] of Object.entries(files)) {
  const path = join(OUT, name);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (check) {
    let current = '';
    try { current = readFileSync(path, 'utf8'); } catch { /* missing */ }
    if (current !== text) {
      stale += 1;
      console.error(`stale: templates/.claude/std/${name}`);
    }
  } else {
    writeFileSync(path, text);
    const p = value.permissions;
    console.log(`wrote templates/.claude/std/${name}: allow ${p.allow.length}, ask ${p.ask.length}, deny ${p.deny.length}`);
  }
}
if (stale) {
  console.error('Run: node scripts/build-settings.mjs');
  process.exit(1);
}
if (check) console.log('PASS: settings templates are up to date.');
