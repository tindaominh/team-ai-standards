# 00. Quickstart

One page for developers. You do not need to read the other documents to start; they explain the reasons.

## Adopt the standard in a repository (about 30 minutes)

1. **Run the adoption script** from the root of the repository, with a checkout of this standard next to it. First look at what it detects:

    ```bash
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
    ```

    - It detects the framework, databases, data-access library and AWS use from `package.json` and shows them. If the selection is right, run again with `--yes`. If not, or if it says detection is ambiguous, pass flags: `--framework nestjs|express|none`, `--db mysql|postgres` (one or more), `--data-access typeorm|raw|none`, `--with aws` or `--without-optional`. Framework `none` is for services without a web framework (workers, consumers); data access `none` is for repositories without a database. If the repository uses something the standard has no fragment for (for example Fastify or Prisma), the script stops: ask the owner of the standard to add a fragment (doc 11), or pass the flag explicitly; the dependency is then recorded in `.claude/project.json` as `acknowledgedUnsupported`.
    - Shortcuts: `--stack nestjs-mysql`, `nestjs-postgres` or `node-postgres` (no framework + PostgreSQL + TypeORM), each with the AWS rule.
    - `--profile`: `strict` for client repositories (default), `standard` only for internal repositories. Unsure? Use `strict`.
    - Add `--with-docs` to also install the documentation checks (doc 09).
2. **Fill in the project details.** Complete the `TODO(adopt)` items in `CLAUDE.md`, and set any command marked `TODO` in `.claude/project.json`, then run `node .claude/std/compose-settings.mjs`. Replace `<org>/<repo-team>` in `CODEOWNERS`.
3. **Merge proposals, if any.** The script never overwrites your files. If it wrote `*.proposed` files, follow `.claude/std-adoption-checklist.md`, then delete the proposals and the checklist.
4. **Check and open a PR.** Run `node .claude/std/compose-settings.mjs --check`, open a pull request, and ask the owner of the standard to register the repository for updates.

## Daily workflow

- **Plan first** for anything bigger than a small fix: `/std-plan`. Approve the plan before code is written.
- **Test first:** `/std-tdd-workflow`. A test fails for the right reason, then passes.
- **Verify before saying "done":** `/std-verification` until it reports READY.
- **Review with fresh eyes:** `/std-code-review` (and `/std-security-review` or `/std-db-migration-review` when they apply). Fix or answer every CRITICAL and HIGH finding.
- **Open the PR with the evidence** the template asks for. A human reviews and merges. Never paste secrets, customer data or production data into the AI.

## Where to change things

| You want to change | Change it here | Layer |
| --- | --- | --- |
| Project description, layout, architecture, repository rules | `CLAUDE.md` | Project |
| Build, test or migration commands | `.claude/project.json` → `commands`, then run `node .claude/std/compose-settings.mjs` | Project |
| Extra permission rules for this repository | `.claude/project.json` → `permissions`, then run the same command | Project |
| Longer project rules | a new file in `.claude/rules/local/` | Project |
| Your own preferences (model, extra stricter rules) | `.claude/settings.local.json` (never committed) | Personal |
| Framework, databases or data access used by the repository | `.claude/project.json` → `stack`; the next update PR installs the matching rules (or ask the owner of the standard to run it now) | Project |
| Anything in `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, `.claude/settings.json` | Not here: propose the change to the standard repository (new stacks: doc 11) | Standard |

The `std-check` workflow fails a pull request that edits standard files by hand.

## How updates arrive

When a new version of the standard is released, your repository receives one pull request named `chore: update team AI standard to vX.Y.Z`. It changes only standard files and lists what changed. Review it like any other PR and merge it. Your `CLAUDE.md`, `.claude/project.json` and local rules are never changed by updates.

## Who to ask

- Questions about the workflow or templates: the wave champion or the owner of the standard.
- Data, security or tool approval questions, or a possible data exposure: the security owner, the same day.
- Names: see the Named people table in 03.
