# <Repository name>

<One or two sentences: what this service does, which channels/marketplaces it talks to, who uses it.>

- **Client / confidentiality:** <internal | client: CLIENT-CODE>. Settings profile: <strict | standard>.
- **Ticket prefix:** <PROJ> (Backlog). **Base branch:** <main>.
- **Team AI standard:** version in `.claude/STANDARD_VERSION`.

## Stack

Node.js <version>, TypeScript <version>, NestJS <version>, TypeORM <version>, MySQL <version> (RDS), AWS ECS (Fargate), SQS <if used>, S3, CloudWatch.

## Layout

```text
src/
  <module>/            NestJS feature module: controller, service, entities, DTOs
  channels/<name>/     marketplace adapters (one module per channel)
  database/            data-source.ts (TypeORM CLI), migrations/
test/                  unit (*.spec.ts) and integration (*.int-spec.ts)
infra/                 <CDK | Terraform>, read-only for the AI
```

## Commands

Skills and settings refer to these placeholders. Fill in the exact command for this repository, then replace the same placeholders in `.claude/settings.json`. Do not invent other commands.

| Placeholder | Purpose | Command in this repository |
| --- | --- | --- |
| `<install-cmd>` | Install dependencies (ask first) | `npm ci` |
| `<build-cmd>` | Build | `<npm run build>` |
| `<lint-cmd>` | Lint | `<npm run lint>` |
| `<typecheck-cmd>` | Typecheck | `<npm run typecheck>` |
| `<unit-test-cmd>` | Unit tests (one file: append the path) | `<npm test>` |
| `<integration-test-cmd>` | Integration tests, local MySQL container | `<npm run test:int>` |
| `<migration-show-cmd>` | List migrations and their status | `<npm run migration:show>` |
| `<migration-generate-cmd>` | Generate a migration (append the name) | `<npm run migration:generate -- src/database/migrations/Name>` |
| `<migration-run-cmd>` | Run migrations on the local database | `<npm run migration:run>` |
| `<migration-revert-cmd>` | Revert the last migration locally | `<npm run migration:revert>` |

Local config: copy `config/env.example` to `.env`. Never read `.env`. Ask the developer if a value is needed.

## Architecture

- <Request flow: controller → service → repository; DTO validation with the global ValidationPipe.>
- <Jobs and workers: SQS consumer, scheduler, separate ECS service.>
- <Channel adapter interface: `path/to/interface.ts`.>
- <Reference implementations to imitate: `path:line`.>

## Hard rules for this repository

- <Example: order status mapping lives only in `src/orders/status-map.ts`.>
- <Example: never change the public webhook payload without a version bump.>
- <Client-specific restrictions, if any.>

## References

- Team workflow: `docs/en/02-development-workflow.md` in the team standard.
- Domain glossary: <link>. Runbook: <link>. Architecture decisions: `docs/adr/`.
