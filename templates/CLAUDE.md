# TODO(adopt): repository name

TODO(adopt): one or two sentences — what this service does, which channels or marketplaces it talks to, who uses it.

- **Stack:** {{STACK_DESCRIPTION}} (`{{STACK}}`). **Settings profile:** `{{PROFILE}}`.
- **Client / confidentiality:** TODO(adopt): internal, or client code (CLIENT-CODE).
- **Ticket prefix:** TODO(adopt): PROJ (Backlog). **Base branch:** TODO(adopt): main.
- **Team AI standard:** files under `.claude/rules/std`, `std-*` agents and skills, version in `.claude/STANDARD_VERSION`. Do not edit them here; project rules go in `.claude/rules/local/`.

## Layout

```text
TODO(adopt): main folders and what lives in each, e.g.
src/<module>/          feature module
src/channels/<name>/   marketplace adapter
src/database/          data source, migrations
test/                  unit and integration tests
infra/                 infrastructure code, read-only for the AI
```

## Commands

Skills refer to these placeholders. Change commands in `.claude/project.json`, then run `node .claude/std/compose-settings.mjs`.

<!-- BEGIN GENERATED: std-commands -->
<!-- END GENERATED: std-commands -->

Local config: copy `config/env.example` to `.env`. Never read `.env`. Ask the developer if a value is needed.

## Architecture

- TODO(adopt): request flow and where validation happens.
- TODO(adopt): jobs and workers (SQS consumer, scheduler, separate ECS service).
- TODO(adopt): channel adapter interface (`path/to/interface.ts`).
- TODO(adopt): reference implementations to imitate (`path:line`).

## Hard rules for this repository

- TODO(adopt): rules that apply only here, or delete this section. Longer rules go in `.claude/rules/local/`.

## References

- Team workflow: `docs/en/02-development-workflow.md` in the team standard.
- TODO(adopt): domain glossary, runbook, architecture decisions (`docs/adr/`).
