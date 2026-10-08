# 09. Keeping documentation current

## Purpose

About ten developers share the same repositories. Documentation goes stale when nobody owns the update, and it causes merge conflicts when everybody edits the same big file. This document defines who may change documentation automatically, where each check runs, and how we avoid conflicts.

## Principles

1. **Local tools remind; CI enforces; humans approve.** Nothing on a developer's machine writes shared files on its own.
2. **Generated content is generated, never hand-edited.** Tables that can be derived from code are produced by a script.
3. **Every documentation change arrives through a pull request** and is reviewed like code.
4. **Small, focused documents** so that parallel work rarely touches the same file.

## 1. Local Claude Code hooks: remind only

- Team hooks may only check or remind (see 05 and `.claude/std/hooks/README.md`).
- A hook may tell Claude or the developer "the env schema changed; update docs/configuration.md". It never edits the document itself, never commits and never pushes.
- Reason: a local hook that writes shared files produces unreviewed changes, conflicts between developers and surprises in diffs.

## 2. CI check on pull requests

Workflow: `templates/.github/workflows/docs-check.yml`, with `templates/scripts/check-docs-updated.mjs`.

| If the PR changes | It must also change |
| --- | --- |
| `config/env.schema.json`, `config/env.example`, `src/config/**` | `docs/`, `README.md` or `CLAUDE.md` |
| `scripts` in `package.json` | `docs/`, `README.md` or `CLAUDE.md` |
| `.github/workflows/**` | `docs/`, `README.md` or `CLAUDE.md` |

Controlled bypass:

- When no documentation change is needed, a **reviewer** adds the label `docs-not-needed`.
- The check accepts the label only if it was added by someone **other than the PR author**. The job summary records who added it.
- The reviewer confirms in a PR comment why no docs change is needed.
- Create the label once per repository.

The same workflow also fails when generated sections are stale (next section).

## 3. Generated sections

Some documentation is derived from code. It lives between markers and is produced by `scripts/generate-docs.mjs` (template: `templates/scripts/generate-docs.mjs`).

```markdown
<!-- BEGIN GENERATED: env-vars -->
(generated table)
<!-- END GENERATED: env-vars -->
```

| Section name | Source | Content |
| --- | --- | --- |
| `env-vars` | `config/env.schema.json`, exported from the zod env schema | Variable, required, default, secret, description. Secret variables never show a value. |
| `commands` | `package.json` `scripts` (+ optional `scriptsInfo` descriptions) | Command, what it runs, description |

Rules:

- Humans never edit inside the markers. Change the source, then run `node scripts/generate-docs.mjs` and commit the result.
- The script rewrites only the text between markers and is idempotent: running it twice changes nothing.
- CI runs `node scripts/generate-docs.mjs --check`. When a section is stale, the job fails and prints the command to run.
- Generated sections belong in `docs/` or `README.md`, not in `CLAUDE.md`. CLAUDE.md keeps its hand-written command table, because the AI needs the mapping, not every script.

### Environment variables from the zod schema

Our NestJS services validate configuration with zod. The same schema feeds the documentation, so descriptions are written once.

1. **Schema** in one file, `src/config/env.schema.ts`, with `.describe()` on every variable. Mark secrets with `.meta({ 'x-secret': true })`:

    ```ts
    import { z } from 'zod';

    export const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development').describe('Runtime environment'),
      PORT: z.coerce.number().int().positive().default(3000).describe('HTTP port'),
      DB_HOST: z.string().min(1).describe('MySQL host'),
      DB_PASSWORD: z.string().min(1).describe('MySQL password').meta({ 'x-secret': true }),
    });

    export type Env = z.infer<typeof envSchema>;

    export function validateEnv(config: Record<string, unknown>): Env {
      return envSchema.parse(config);
    }
    ```

2. **Startup validation** with `@nestjs/config`: `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`. The application refuses to start with invalid configuration.
3. **Export** with `templates/scripts/export-env-schema.ts`, run as `npm run docs:env-schema` (package.json: `"docs:env-schema": "<ts-runner> scripts/export-env-schema.ts"`, using the TypeScript runner the repository already has). It writes `config/env.schema.json` with `z.toJSONSchema(envSchema, { io: 'input' })`. The `input` mode matters: variables with a default are then not listed as required. The file also records the source path and its SHA-256 (`x-source`, `x-source-sha256`).
4. **Generate** with `node scripts/generate-docs.mjs` and commit both `config/env.schema.json` and the updated docs.

The generator fails with a clear message when `config/env.schema.json` is missing, or when it is stale (the zod source changed after the last export). The message names the command to run. Keep the whole env schema in the one source file, or the hash cannot see changes.

zod versions:

- **zod v4 (recommended):** `z.toJSONSchema` is built in; nothing else to install. The template and the example assume v4.
- **zod v3:** needs the helper package `zod-to-json-schema`, pinned to an exact version in `devDependencies`. In the export script, replace `z.toJSONSchema(...)` with `zodToJsonSchema(envSchema)`; it already treats variables with a default as optional. v3 has no `.meta()`, so list the secret variable names in the export script and add `'x-secret': true` to those properties there. Plan the upgrade to v4.

## 4. Optional AI documentation job

Workflow: `templates/.github/workflows/docs-ai-proposal.yml`. **Disabled by default and out of scope for the Wave 1 pilot.** It sends repository content to an AI provider. Enabling it requires all of the following:

- Written approval from the security owner. Never in a client repository unless the client's written AI position allows it.
- The CLI installed from a committed `tools/docs-ai/package.json` (template: `templates/tools/docs-ai/package.json`) with a reviewed `package-lock.json`, using `npm ci --ignore-scripts`. npm checks every package against the lockfile integrity hashes and runs no install scripts. **Never `npx`.** Create the lockfile with `npm install --package-lock-only --ignore-scripts --prefix tools/docs-ai`. Because install scripts are skipped, the workflow starts the CLI through the package's `cli-wrapper.cjs`.
- The GitHub environment `docs-ai`, with required reviewers and deployment branches limited to the default branch, holding `ANTHROPIC_API_KEY` from a company account as an environment secret (never a repository secret; 05, section 6). In a private repository this needs GitHub Pro, Team or Enterprise, and required reviewers need GitHub Enterprise (05, section 6.1). And the repository variable `DOCS_AI_PROPOSAL_ENABLED=true`.

What it does: after a merge to `main` that did not touch `docs/`, Claude Code reads the changed files and may propose documentation updates as a **separate pull request**.

Guardrails:

| Guardrail | How |
| --- | --- |
| Off unless explicitly enabled | Runs only when the repository variable `DOCS_AI_PROPOSAL_ENABLED` is `true` |
| Pinned tool | Exact version in `tools/docs-ai/package.json`, installed from the lockfile with `npm ci --ignore-scripts` |
| Minimal tools | Only Read, Grep, Glob and Edit; edits allowed only under `docs/`; no shell, no web access |
| No silent approvals | Unanswered permission prompts are denied (`--permission-prompts none`) |
| Limits | Maximum turns and a cost budget per run; job timeout |
| No credentials in reach | Checkout without persisted credentials; the token is used only in the final push step |
| Secret behind review | The job runs in the `docs-ai` environment; a workflow changed on an unreviewed branch cannot read the API key |
| Scope check | The job fails if any file outside `docs/` changed |
| Secret check | The job fails if the diff matches common secret patterns |
| Never on main | Pushes only a new `docs-ai/<sha>` branch and opens a PR |
| Human review | CODEOWNERS for `docs/` must approve; anyone may close the PR |

PRs opened with the workflow token do not start other workflows; a reviewer closes and reopens the PR to run the normal checks.

## 5. Merge notifications

Workflow: `templates/.github/workflows/docs-notify.yml`.

- Trigger: push to `main` that touches `docs/**`, `CLAUDE.md` or `.claude/**`.
- Message: repository, commit title, author, changed file paths (at most 20) and a link. Never file contents or diffs.
- **Slack is the default provider.** Microsoft Teams is the ready-made alternative: set the repository variable `CHAT_PROVIDER=teams` to switch from the Slack step to the Teams step.
- Webhook URLs come only from GitHub Secrets: `SLACK_WEBHOOK_URL` or `TEAMS_WEBHOOK_URL`, stored as secrets of the `docs-notify` environment (required reviewers where the plan offers them, deployment branches limited to the default branch), never as repository secrets (05, section 6). Plan requirement for a private repository: environment secrets and deployment branches need GitHub Pro, Team or Enterprise, and required reviewers need GitHub Enterprise. On GitHub Free the environment exists but blocks nothing, so do not enable this job there without the security owner's written approval (05, section 6.1). Never put them in files. Rotate a webhook if it is ever exposed.
- If the secret for the selected provider is not set, the job logs a notice and does nothing.
- Other providers: add a step that follows the same pattern (message from the file, URL or token from a secret), after security owner approval.

## 6. Ownership

- `templates/.github/CODEOWNERS` assigns `docs/`, `README.md`, `CLAUDE.md`, `.claude/` and workflows to owners.
- Enable "Require review from Code Owners" on the base branch, so changes to AI configuration and shared docs always get an owner's review.

## 7. Avoiding conflicts

- **Split by topic.** One document per subject (configuration, deployment, a channel adapter, a runbook) rather than one large file.
- **Keep CLAUDE.md short and stable.** Details go to `docs/`; CLAUDE.md links to them. Change it only when commands, layout or hard rules change.
- **Small PRs.** Documentation changes ship with the code change that needs them, not in a big batch later.
- **Generated sections** remove the most common source of conflicts: hand-edited tables.
- **Rebase often** on long-running branches that touch docs. Developers do this; the AI never rebases shared branches.

## 8. Setup checklist for a repository

`node <path-to-standard>/scripts/adopt.mjs --with-docs` installs the scripts and the `docs-check` and `docs-notify` workflows, and keeps them updated with the standard. The checklist below covers the rest.

- [ ] Run the adoption script with `--with-docs` (or, for an already adopted repository, ask the owner of the standard); add the `docs:env-schema` npm script.
- [ ] Add markers where generated tables should appear; run the generator; commit.
- [ ] Create the `docs-not-needed` label.
- [ ] Fill in the owners in `CODEOWNERS` and enable code-owner review.
- [ ] Before any job with secrets runs: create its GitHub environment (`docs-notify`, later `docs-ai`) with required reviewers where the plan offers them and deployment branches limited to the default branch. GitHub creates a missing environment on first use without protection rules (05, section 6). Check the plan first (05, section 6.1). In a private repository on GitHub Pro or Team there are no required reviewers, so deployment branches limited to the protected default branch are the only control. On GitHub Free the environment blocks nothing: do not enable these jobs without the security owner's written approval.
- [ ] Optional: set `SLACK_WEBHOOK_URL` for `docs-notify.yml` (or `CHAT_PROVIDER=teams` and `TEAMS_WEBHOOK_URL`) as a secret of the `docs-notify` environment.
- [ ] Not in the pilot. Later, only after security owner approval: copy `docs-ai-proposal.yml` and `tools/docs-ai/package.json`, commit the lockfile, enable it.
