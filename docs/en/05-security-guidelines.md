# 05. Security guidelines for AI-assisted development

## Purpose

How we keep client code, customer data and credentials safe when AI tools work in our repositories. It covers prompt injection, the threat model, permissions, isolation, extensions (plugins, skills, hooks, MCP servers), secret handling and incidents.

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

## 3. Threat model

**Permission rules are guardrails against mistakes, not a security boundary.** They stop the AI from running the wrong command by accident and make it ask before risky ones. They do not stop code that the AI wrote from running.

- The commands the profiles allow without asking (test, lint, typecheck, build) execute repository code: test files, tool configs such as `eslint.config.*`, `vitest.config.*` or `jest.config.*`, package scripts and git hooks. The AI can write all of them. A test file can read `~/.aws/credentials`, call the network or start `cdk synth`, and the command is still only `pnpm test`.
- Code running inside Node is not covered by Bash rules or by `Read` and `Edit` deny rules. The official documentation ("Configure permissions", <https://code.claude.com/docs/en/permissions>) states that `Read` and `Edit` deny rules "don't apply to a command that reads files without naming them … or to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox."

**The real boundary is the environment:** which credentials and which network access exist where the AI runs. A secret that is not on the machine cannot leak, and an expired cloud session cannot be used.

Mitigations in this standard:

| Mitigation | Where |
| --- | --- |
| Ask before editing guard files: files that change what allowed commands run, or that weaken guardrails | 4, "Both profiles ask before" |
| Guard files are owned by the repository's owner in `CODEOWNERS`, and reviewers check them with extra care | `CODEOWNERS` standard block; 04, section 12 |
| Adoption drops an existing `allow` rule whose package script runs a command the profile asks about or denies | 10, section 6 |
| No real secrets in `.env` files inside the repository; secrets are injected at run time | 6; 01 |
| Cloud credentials are short-lived or MFA-protected; no long-lived access keys on developer machines | 6; 01 |
| CI secrets only in GitHub environments with required reviewers | 6; 09 |
| Content from outside is data, not instructions | 2; rule `untrusted-content.md` |
| Isolation (optional, recommended for client repositories) | 3.1 |

### 3.1 Isolation (optional, recommended for client repositories)

Isolation limits what commands can reach, whatever the permission rules say. The options below are the ones the official Claude Code documentation describes; use only the settings it documents. The standard's profiles do not set them: put them in your user settings or `.claude/settings.local.json`.

**Claude Code's sandbox** (<https://code.claude.com/docs/en/sandboxing>):

- What it covers: "The Bash sandbox is a boundary that the operating system enforces around the shell commands Claude runs on your machine … the limits apply to Bash, PowerShell, and Monitor commands and the processes they start." So it also covers the code that test and build commands run.
- Platforms: "The sandbox runs on macOS, Linux, and WSL2. On native Windows, Claude Code runs commands unsandboxed." macOS uses the built-in Seatbelt framework; Linux and WSL2 need `bubblewrap` and `socat`.
- Turning it on: "The sandbox is off by default. To turn it on, run `/sandbox` in a session … or set `sandbox.enabled` to `true` in a settings file".
- Defaults: writes go to "The working directory, a per-user temp directory, and directories you've added"; reads reach "Most of the machine, including credential files such as `~/.ssh` and `~/.aws/credentials`" unless you deny them with `filesystem.denyRead` or `sandbox.credentials`; network connections "go through a proxy on your machine that checks each host against your allowed domains, which start empty"; environment variables are "Inherited from Claude Code, including any secrets in its environment".
- Credentials: entries in `sandbox.credentials` with `"mode": "deny"` make file paths unreadable inside the sandbox and unset environment variables "before each sandboxed command runs". "There is no built-in credential deny list, so only the files and variables you list are restricted." Deny at least `~/.aws` and `~/.ssh`.
- Retries outside the sandbox: Claude may retry a failing command unsandboxed (`dangerouslyDisableSandbox`). Setting `"allowUnsandboxedCommands": false` turns this off ("strict sandbox mode").
- Not covered: "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks run outside it." Commands you type at the `!` prompt and commands listed in `excludedCommands` also run outside it.

**A dev container, another container or a virtual machine** (<https://code.claude.com/docs/en/sandbox-environments>):

- These put "the whole Claude Code process inside the isolation boundary, so file tools, MCP servers, and hooks are restricted too".
- Claude Code publishes an example dev container "with a default-deny iptables firewall as a starting point" (<https://code.claude.com/docs/en/devcontainer>). Copy it into the repository and adjust the firewall allowlist, the base image and the pinned Claude Code version. Mount only the project and the credentials the task needs.
- Committing it is "a convention rather than an enforcement boundary, because Claude Code does not require a container."

Limits, from the same page: "Any approach that allows network egress can still leak data the agent can read, and any approach that mounts your project directory writable can still modify that code." Bypass-permissions mode stays disabled by our profiles, also inside a container.

## 4. Permissions

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
- Commands that start long-running processes or use real credentials: dev servers (`npm/pnpm/yarn dev*`, `start*`, `serve*`, `watch*`, `next dev`, `nest start`, `vite`) and infrastructure tools (`cdk`, `terraform`, `sam`, `serverless`/`sls`, `pulumi`, `copilot`, `eb`, and `cdk*` package scripts). `cdk diff` and `cdk synth` read the developer's real cloud account. The deploy and destroy forms stay denied.
- Editing guard files: every `package.json`, `.claude/project.json`, `.claude/rules/local/**`, `.husky/**`, `.github/workflows/**`, and configs that allowed commands execute (`eslint.config.*`, `.eslintrc*`, `vitest.config.*`, `jest.config.*`, `tsconfig*.json`). They change what allowed commands run, or weaken guardrails. The rules are written as `Edit(...)`, for example `Edit(**/package.json)` and `Edit(/.github/workflows/**)`: the documentation states that "`Edit` rules apply to all built-in tools that edit files", and that for a path rule written for `Write`, "Claude Code accepts the rule but never consults it". The `Write` tool is not left unguarded by this: the tools reference (<https://code.claude.com/docs/en/tools-reference>) lists the rule format `Edit(/src/**)` as applying to "Edit, Write, NotebookEdit", and describes Write as the tool that "creates a new file or overwrites an existing one with the full content provided". So full-file overwrites and new files go through the same `Edit(...)` ask rules. A `/path` pattern is relative to the settings file's project, and `**/` matches at any depth. An ask rule prompts in every mode: the documentation lists "Tools matched by an explicit ask rule" among the actions that "Claude Code doesn't auto-approve … in any mode, including `bypassPermissions`" (<https://code.claude.com/docs/en/permission-modes>). Like every `Edit` rule, these do not stop a script that writes the file itself (3).

Both profiles allow without asking:

- The repository's build, lint, typecheck, unit test, integration test and migration-status commands, `npm audit`, and read-only git commands.
- In the template these appear as placeholders (`<build-cmd>`, `<unit-test-cmd>`, …). Replace them with the commands from the CLAUDE.md command table. An unfilled placeholder matches nothing, so the command just asks.

Limits of permission rules (from the official Claude Code documentation, "Configure permissions"):

- A trailing `*` with a space before it also matches the bare command: "`Bash(ls *)` matches `ls`, and `Bash(git log *)` matches `git log`. That holds only when the trailing `*` is the rule's only wildcard." So `Bash(pnpm test *)` also allows `pnpm test`, and an ask `Bash(pnpm migration:run *)` also asks for `pnpm migration:run`.
- Bash rules match the command text Claude writes. The documentation states that such a rule "covers the invocation Claude usually produces and isn't a security boundary around the program". The same program called by its full path, inside `sh -c`, or from a script is not matched.
- `Read` and `Edit` deny rules also cover file commands Claude Code recognises in Bash (`cat`, `head`, `tail`, `sed`, `tee`) and redirections. They do **not** cover commands that read files without naming them (for example `grep -r pattern .`) or scripts that open files themselves.
- Deny rules in `permissions.deny` apply to the main conversation and to subagents.
- So: permission rules are guardrails, not a boundary (3). Keep real secrets out of the working copy and watch what the AI runs. For enforcement at operating-system level, use isolation (3.1).

Local overrides:

- `.claude/settings.json` is generated from the base profile and `.claude/project.json`; never edit it by hand. Repository-specific rules go in `permissions` in `.claude/project.json`.
- Personal changes go in `.claude/settings.local.json` (never committed). The standard's deny and ask rules still apply: the official documentation states that "if a tool is denied at any level, no other level can allow it". What you may and may not set there is listed in 10, "Personal settings (Layer 3)". You may not relax the rules for client repositories without approval from the security owner.

## 5. Third-party extensions: plugins, skills, hooks, MCP servers

Extensions add instructions, tools or code to your AI sessions. Some run code on your machine on every tool call; some connect to remote services. Evaluate every extension with the rules below before installing it, even if it is popular.

### 5.1 Risks to look for

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

### 5.2 Evaluation rules

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

### 5.3 MCP servers

- Only MCP servers approved by the security owner, pinned, with the minimum scopes and tokens.
- Prefer read-only access. A server with write access to a ticket tool, repository host or cloud account is a high-risk approval.
- Do not auto-enable servers defined in a repository (`enableAllProjectMcpServers` is `false` in our settings).
- Credentials for MCP servers live in your local secret store or environment, never in committed files.

### 5.4 Our own hooks

Team hooks may only **check** or **remind**. A team hook must never write or modify repository files, write shared files (docs, CLAUDE.md, settings), commit or push, call the network, download anything, or send data off the machine. Writing and publishing happen through the developer or through CI on a pull request (see 09).

Our optional hooks (`.claude/std/hooks/`, enabled with `"hooks": true` in `.claude/project.json`) follow this rule: they are deterministic, run only local binaries in check mode, and document what they read and run. Any new hook goes through the same review.

## 6. Secret handling

- Production and staging secrets live in AWS Secrets Manager or SSM Parameter Store. Applications read them at runtime through the config module.
- While working with AI, `.env` files inside the repository hold only local or fake values. Real secrets are injected at run time from a password-manager CLI or a similar secret store, for example `<secret-cli> run -- npm start`, so they exist only in the environment of the command that needs them. The profiles' deny on reading `.env` is a second line only: it does not stop a test or a script from opening the file (3).
- Do not start Claude Code from a shell that has real secrets in its environment: every command the AI runs inherits them.
- Cloud credentials on developer machines are short-lived (SSO or assumed-role sessions) or protected by MFA. No long-lived access keys on developer machines, for example static keys in `~/.aws/credentials`.
- Keep a committed `config/env.example` with variable names and fake values. The AI can read it; it cannot read `.env`.
- CI uses GitHub OIDC to assume AWS roles. No long-lived AWS keys in GitHub secrets.
- Every CI job that uses secrets runs in a GitHub environment with required reviewers and deployment branches limited to the default branch (or to release tags). The secrets are environment secrets, never repository or organisation secrets, so a workflow changed on an unreviewed branch cannot read them. From the GitHub documentation (<https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>): "Secrets stored in an environment are only available to workflow jobs that reference the environment", and "If the environment requires approval, a job cannot access environment secrets until one of the required reviewers approves it."
- Create the environment before the workflow first runs: "Running a workflow that references an environment that does not exist will create an environment with the referenced name", and that environment "will not have any protection rules or secrets configured" (<https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>).
- Not every GitHub plan can protect an environment in a private repository: see 6.1 before enabling a workflow that uses secrets.
- A secret scanner runs in CI and blocks the PR on findings.
- Never paste a secret into a prompt, a ticket, a PR or a chat, even "just for a second".

### 6.1 GitHub plan requirements for environments in private repositories

From the GitHub documentation ("Deployments and environments", <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>, and "Managing environments for deployment", <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>):

- "Users with GitHub Free plans can only configure environments for public repositories. If you convert a repository from public to private, any configured protection rules or environment secrets will be ignored, and you will not be able to configure any environments."
- "Organizations with GitHub Team and users with GitHub Pro can configure environments for private repositories."
- "If you are using GitHub Free, environment secrets are only available in public repositories. For access to environment secrets in private or internal repositories, you must use GitHub Pro, GitHub Team, or GitHub Enterprise."
- "Deployment branches and tags are available for all public repositories. For users on GitHub Pro or GitHub Team plans, deployment branches and tags are also available for private repositories."
- "If you are on a GitHub Free, GitHub Pro, or GitHub Team plan, required reviewers are only available for public repositories." The same sentence is given for wait timers, and custom deployment protection rules "are only available for public repositories for users on GitHub Free, GitHub Pro, and GitHub Team plans."

So, for a private repository:

| Plan | Environment secrets | Deployment branches and tags | Required reviewers, wait timers |
| --- | --- | --- | --- |
| GitHub Free | No | No | No |
| GitHub Pro, GitHub Team | Yes | Yes | No |
| GitHub Enterprise | Yes | Yes | Yes (the limits above name only Free, Pro and Team) |

What happens without them. A job that references an environment always runs; the environment blocks only through its protection rules: "Deployment protection rules require specific conditions to pass before a job referencing the environment can proceed."

- **Without required reviewers (GitHub Pro or Team):** the environment exists and its secrets are separate from repository secrets, but no one approves a run. The deployment branch rule is then the only control. Set it to **Selected branches and tags** with the default branch (or the release tags), and protect that branch. A workflow changed on another branch cannot use the environment, but a workflow change merged to the default branch runs with the secrets without a second approval. That is why `.github/workflows/**` is a guard file (4) owned in `CODEOWNERS` (04, section 12).
- **Without environments (GitHub Free):** the workflow still references the environment, but nothing can be configured, so it blocks nothing, and the secrets would have to be repository secrets that a workflow on any branch can read. Do not enable workflows that use secrets (`docs-notify`, `docs-ai-proposal`) in such a repository without written approval from the security owner.
- **Environment never configured (any plan):** GitHub creates it on the first run, and it "will not have any protection rules or secrets configured", so the job runs and finds no secrets. Configure it first.

## 7. Personal and client data

- Never give the AI production data, dumps, logs or support tickets containing customer data.
- Reproduce bugs with synthetic data.
- When a feature itself sends data to an LLM in production, follow 06-llm-in-product-pattern and get security owner approval.

## 8. Incidents

Examples: a secret was shown to or pasted into an AI tool, an AI tool read a `.env` or dump, an unapproved extension ran in a client repository, the AI ran a mutating cloud command.

1. **Stop** the session. Do not try to clean up through the AI.
2. **Tell the security owner the same day**: what, when, which tool, which repository, which data.
3. **Rotate** any exposed secret. A human does this through the normal process, never the AI.
4. **Record** the incident and the follow-up (settings change, training, rule change).
5. For client data, the project lead decides with the security owner whether the client must be informed, as the contract requires.

Reporting early is expected and never punished. Hiding an incident is a serious violation.
