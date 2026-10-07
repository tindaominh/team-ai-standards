# <Repository name>

<One or two sentences: what this service does, which channels/marketplaces it talks to, who uses it.>

- **Client / confidentiality:** <internal | client: CLIENT-CODE>. Settings profile: <strict | standard>.
- **Ticket prefix:** <PROJ> (Backlog). **Base branch:** <main>.
- **Team AI standard:** <link to team-ai-standards, version x.y.z>.

## Stack

Node.js <version>, TypeScript <version>, <NestJS | Express | other>, TypeORM <version>, MySQL <version> (RDS), AWS ECS (Fargate), SQS <if used>, S3, CloudWatch.

## Layout

```text
src/
  <module>/            <what lives here>
  channels/<name>/     marketplace adapters (one folder per channel)
  migrations/          TypeORM migrations
test/                  <unit | integration layout>
infra/                 <CDK | Terraform>, read-only for the AI
```

## Commands

Use these exact commands. Do not invent others.

| Purpose | Command |
|---|---|
| Install (ask first) | `npm ci` |
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Integration tests (local MySQL container) | `npm run test:integration` |
| Single test file | `npm test -- <path>` |
| Show migrations | `npm run migration:show` |
| Generate migration | `npm run migration:generate -- src/migrations/<Name>` |

Local config: copy `config/env.example` to `.env`. Never read `.env`. Ask the developer if a value is needed.

## Architecture

- <Request flow: controller → service → repository; where validation happens.>
- <How jobs/workers run: SQS consumer, scheduler, ECS task.>
- <Where channel adapters plug in and the interface they implement: `path/to/interface.ts`.>
- <Key reference implementations to imitate: `path:line`.>

## Hard rules for this repository

- <Example: order status mapping lives only in `src/orders/status-map.ts`.>
- <Example: never change the public webhook payload without a version bump.>
- <Client-specific restrictions, if any.>

## References

- Team workflow: `docs/en/02-development-workflow.md` in the team standard.
- Domain glossary: <link>. Runbook: <link>. Architecture decisions: `docs/adr/`.
