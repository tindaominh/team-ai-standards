# TODO(adopt): repository name

TODO(adopt): one or two sentences — what this service does, which channels or marketplaces it talks to, who uses it.

<!-- std:begin standard -->
<!-- std:end standard -->

<!-- std:begin commands -->
<!-- std:end commands -->

## Project

- **Client / confidentiality:** TODO(adopt): internal, or client code (CLIENT-CODE).
- **Ticket prefix:** TODO(adopt): PROJ (Backlog). **Base branch:** TODO(adopt): main.
- Local config: copy `config/env.example` to `.env`. Never read `.env`. Ask the developer if a value is needed.

## Layout

```text
TODO(adopt): main folders and what lives in each, e.g.
src/<module>/          feature module
src/channels/<name>/   marketplace adapter
src/database/          data source, migrations
test/                  unit and integration tests
infra/                 infrastructure code, read-only for the AI
```

## Architecture

- TODO(adopt): request flow and where validation happens.
- TODO(adopt): jobs and workers (SQS consumer, scheduler, separate ECS service).
- TODO(adopt): channel adapter interface (`path/to/interface.ts`).
- TODO(adopt): reference implementations to imitate, as path + symbol (`src/orders/orders.service.ts` `OrdersService.create`), not line numbers.

## Hard rules for this repository

- TODO(adopt): rules that apply only here, or delete this section. Longer rules go in `.claude/rules/local/`.

## References

- TODO(adopt): domain glossary, runbook, architecture decisions (`docs/adr/`).
