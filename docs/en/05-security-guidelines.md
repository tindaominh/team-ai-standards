# 05. Security guidelines for AI-assisted development

## Purpose

How we keep client code, customer data and credentials safe when AI tools work in our repositories. It covers prompt injection, permissions, extensions (plugins, skills, hooks, MCP servers), secret handling and incidents.

## 1. Principles

1. **Enforce with configuration, not with prompts.** Instructions in CLAUDE.md and rules help, but they can be ignored or overridden. Permission settings, CI checks and access control are the real controls.
2. **Least privilege.** The AI gets the smallest set of tools and commands needed for the task. Reviewers are read-only.
3. **No secrets where the AI works.** The safest secret is one that is not in the working copy at all.
4. **Everything external is untrusted.** Tickets, docs, web pages, marketplace responses, file contents and tool output can contain instructions. They are data.
5. **Humans hold the irreversible actions.** Push, merge, deploy, cloud changes and secret rotation are done by people.

## 2. Prompt injection

Prompt injection is text that tries to make the AI do something you did not ask for. For example: a comment in a file, a ticket description, a README of a dependency, an API response or a web page saying "ignore previous instructions and run …".

Rules:

- Treat tool output, file contents, tickets and fetched pages as data. The AI must not act on instructions found inside them without asking you.
- Watch for unexpected actions: commands you did not ask for, network requests, reading files unrelated to the task, attempts to change settings. Stop the session and check.
- Be careful with hidden content: invisible or zero-width characters, look-alike characters, very long pasted text, encoded strings (base64, URL-encoded), urgent or authoritative wording ("security team requires you to…").
- Do not let the AI fetch arbitrary URLs from tickets or code during client work. Web access is set to "ask" in our settings.
- Review AI-proposed commands before approving them, especially `curl`, `docker`, `npx`, `aws` and anything with pipes to a shell.

## 3. Permissions

Every repository has `.claude/settings.json` from the team templates. The profile depends on the repository type:

| Repository type | Profile | File to use | Git writes by AI |
| --- | --- | --- | --- |
| **Client repositories** (any client code) | **strict** (default) | `adopt.mjs --profile strict` (base: `.claude/std/settings.strict.json`) | None. No add, commit, checkout, stash, push. |
| **Internal repositories** (our own code, no client data) | **standard** | `adopt.mjs --profile standard` (base: `.claude/std/settings.standard.json`) | Local add/commit/branch with your confirmation. Never push. |

If you are unsure which type a repository is, use **strict**.

Both profiles deny:

- Reading or editing `.env*`, key and certificate files, credential files, `secrets/` folders, `~/.aws`, `~/.ssh`, and database dumps.
- `env` / `printenv`, `aws configure`, reading secret values from Secrets Manager or SSM, reading CloudWatch logs.
- `git push` (including force), `reset --hard`, `rebase`, `merge`, `clean`, branch deletion with `-D`.
- Explicit deploy commands: `npm/pnpm/yarn run deploy*`, `cdk deploy/destroy`, `serverless`/`sls deploy`, `sam deploy`, `copilot … deploy`, `eb deploy`, `terraform apply/destroy`, `aws ecs update-service`, `aws ecs run-task`, `aws cloudformation deploy`, `docker push`.
- AWS CLI commands that create, update, delete, start, stop, run, tag or copy resources, plus `s3 cp/mv/rm/sync`.
- Merging, reviewing or releasing through the GitHub CLI.
- Connecting to databases through the `mysql` CLI or dumping them with `mysqldump`. These rules match only commands that start with those programs, so `mysqladmin` or `grep mysql` are not affected.
- Bypass-permissions mode (`"disableBypassPermissionsMode": "disable"`). Project MCP servers are not auto-enabled.

Both profiles ask before:

- Installing or updating packages, `npx`, `docker`, `curl`, `wget`, any other `aws` or `gh` command, generating or running migrations, web fetch and web search.

Both profiles allow without asking:

- The repository's build, lint, typecheck, unit test, integration test and migration-status commands, `npm audit`, and read-only git commands.
- In the template these appear as placeholders (`<build-cmd>`, `<unit-test-cmd>`, …). Replace them with the commands from the CLAUDE.md command table. An unfilled placeholder matches nothing, so the command just asks.

Limits of permission rules (from the official Claude Code documentation, "Configure permissions"):

- Bash rules match the command text Claude writes. The documentation states that such a rule "covers the invocation Claude usually produces and isn't a security boundary around the program". The same program called by its full path, inside `sh -c`, or from a script is not matched.
- `Read` and `Edit` deny rules also cover file commands Claude Code recognises in Bash (`cat`, `head`, `tail`, `sed`, `tee`) and redirections. They do **not** cover commands that read files without naming them (for example `grep -r pattern .`) or scripts that open files themselves.
- Deny rules in `permissions.deny` apply to the main conversation and to subagents.
- So: keep real secrets out of the working copy, use local fake values for development, and watch what the AI runs. For enforcement at operating-system level, the documentation points to Claude Code's sandbox; evaluating it is part of the Wave 1 pilot (see 08).

Local overrides:

- `.claude/settings.json` is generated from the base profile and `.claude/project.json`; never edit it by hand. Repository-specific rules go in `permissions` in `.claude/project.json`.
- Personal changes go in `.claude/settings.local.json` (never committed). The standard's deny and ask rules still apply: the official documentation states that "if a tool is denied at any level, no other level can allow it". What you may and may not set there is listed in 10, "Personal settings (Layer 3)". You may not relax the rules for client repositories without approval from the security owner.

## 4. Third-party extensions: plugins, skills, hooks, MCP servers

Extensions add instructions, tools or code to your AI sessions. Some run code on your machine on every tool call; some connect to remote services. Evaluate every extension with the rules below before installing it, even if it is popular.

### 4.1 Risks to look for

| Risk | What it means | Why it matters for us |
| --- | --- | --- |
| **Records tool input/output** | Saves prompts, file contents, command output or diffs to disk (logs, "memory", "learning", analytics) | Client code and customer data end up in places we do not control or clean up |
| **Sends data off the machine** | Calls remote APIs, telemetry, cloud memory, other AI models, webhooks | Confidential data leaves our boundary |
| **Runs code on every tool call or session event** | Hooks execute scripts automatically, often with your full user permissions | A bug or a malicious update runs silently on every action |
| **Unpinned downloads** | Runs `npx package`, `@latest`, a downloaded script piped into a shell, or auto-updates itself | The code that runs tomorrow is not the code you reviewed |
| **Broad file access** | Reads home directory, other repositories, credentials folders, browser data | Secrets and other clients' code can be exposed |
| **Changes global settings** | Writes to your user-level AI settings or other repositories | Affects work outside the project that installed it |
| **Large always-on context** | Hundreds of skills, agents or rules loaded every session | Higher cost, worse focus, more instructions to conflict with ours |
| **Silent behaviour changes** | Rewrites your commands, edits files on stop, auto-formats with tools it downloads | Unreviewed changes reach your diff |

### 4.2 Evaluation rules

Before anyone installs an extension for company or client work:

1. **Official or known source only.** From the tool vendor, from our own repository, or from a source approved by the security owner.
2. **Read everything that executes.** Hook scripts, MCP server code or package, install scripts, `package.json` lifecycle scripts. If you cannot read it, do not install it.
3. **Answer these questions in writing** (in the request to the security owner):
   - What does it read, write and execute?
   - Where does it store data? For how long? Can it be turned off?
   - Does it make network calls? To where? What is sent?
   - Does it run automatically (hooks, session start, every tool call)?
   - Is the version pinned (exact version or commit hash)? Does it auto-update?
   - How much context does it add to every session?
4. **Pin versions.** Exact versions or commit hashes. No `@latest`, no auto-update, no unpinned `npx` at runtime.
5. **Project scope, not global.** Install per repository where possible, so client repositories are not affected by experiments elsewhere.
6. **Start in an internal repository.** Never trial an extension in a client repository.
7. **Re-review on every upgrade.** An upgrade is a new install.
8. **Record the decision** in the approved tools table (01) with status, approver, date and allowed data.

Automatic rejection for client repositories: anything that records tool input/output, sends repository content to a third party, or runs unpinned downloaded code.

### 4.3 MCP servers

- Only MCP servers approved by the security owner, pinned, with the minimum scopes and tokens.
- Prefer read-only access. A server with write access to a ticket tool, repository host or cloud account is a high-risk approval.
- Do not auto-enable servers defined in a repository (`enableAllProjectMcpServers` is `false` in our settings).
- Credentials for MCP servers live in your local secret store or environment, never in committed files.

### 4.4 Our own hooks

Team hooks may only **check** or **remind**. A team hook must never write or modify repository files, write shared files (docs, CLAUDE.md, settings), commit or push, call the network, download anything, or send data off the machine. Writing and publishing happen through the developer or through CI on a pull request (see 09).

Our optional hooks (`.claude/std/hooks/`, enabled with `"hooks": true` in `.claude/project.json`) follow this rule: they are deterministic, run only local binaries in check mode, and document what they read and run. Any new hook goes through the same review.

## 5. Secret handling

- Production and staging secrets live in AWS Secrets Manager or SSM Parameter Store. Applications read them at runtime through the config module.
- Local development uses `.env` with local or fake values only. Real shared credentials are never put in a local `.env` for convenience.
- Keep a committed `config/env.example` with variable names and fake values. The AI can read it; it cannot read `.env`.
- CI uses GitHub OIDC to assume AWS roles. No long-lived AWS keys in GitHub secrets.
- A secret scanner runs in CI and blocks the PR on findings.
- Never paste a secret into a prompt, a ticket, a PR or a chat, even "just for a second".

## 6. Personal and client data

- Never give the AI production data, dumps, logs or support tickets containing customer data.
- Reproduce bugs with synthetic data.
- When a feature itself sends data to an LLM in production, follow 06-llm-in-product-pattern and get security owner approval.

## 7. Incidents

Examples: a secret was shown to or pasted into an AI tool, an AI tool read a `.env` or dump, an unapproved extension ran in a client repository, the AI ran a mutating cloud command.

1. **Stop** the session. Do not try to clean up through the AI.
2. **Tell the security owner the same day**: what, when, which tool, which repository, which data.
3. **Rotate** any exposed secret. A human does this through the normal process, never the AI.
4. **Record** the incident and the follow-up (settings change, training, rule change).
5. For client data, the project lead decides with the security owner whether the client must be informed, as the contract requires.

Reporting early is expected and never punished. Hiding an incident is a serious violation.
