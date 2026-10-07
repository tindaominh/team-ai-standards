---
name: db-migration-review
description: Use when a change adds or edits a TypeORM migration, entity column, index or relation on MySQL. Checks lock behaviour, rollout order and rollback before the PR.
---

# Database migration review (TypeORM + MySQL)

## When to use

Any new migration file, any entity change that requires one, any data backfill.

## Steps

1. **Read the generated SQL.** Open the migration and list every statement. Remove anything unrelated to the task: TypeORM sometimes emits DROP/ADD for column renames or for type and charset differences.
2. **Classify each statement:**

   | Statement | Typical MySQL 8 behaviour | Action |
   | --- | --- | --- |
   | Add nullable column / column with default (at end) | often `INSTANT` | State `ALGORITHM=INSTANT` where supported |
   | Add secondary index | `INPLACE`, `LOCK=NONE` | Fine online; check disk and time for big tables |
   | Change column type, shorten length, change charset | `COPY` (table rebuild, writes blocked) | Plan expand–contract or an online schema tool, agreed with ops |
   | Add NOT NULL without default to existing rows | rebuild or failure | Add nullable → backfill → add constraint |
   | Drop column / table | metadata change, irreversible data loss | Only after code stopped using it (contract step), with backup confirmed |
   | Add foreign key | may lock or scan | Check index on child column; consider app-level check |
   | Rename column | breaks old code during rollout | Expand–contract: add new, dual-write, backfill, switch reads, drop old |

   When the expected algorithm and lock matter, write them explicitly in raw SQL (`ALTER TABLE ... , ALGORITHM=INPLACE, LOCK=NONE`). Then MySQL fails fast instead of silently copying the table.
3. **Metadata locks.** Any `ALTER` waits for open transactions on the table and blocks new queries while it waits. Check for long-running jobs or transactions on that table (sync workers, reports). Set a short `lock_wait_timeout` in the migration session (for example `SET SESSION lock_wait_timeout = 5`) so it fails instead of stalling traffic.
4. **Backward compatibility.** The old application version keeps running during an ECS rolling deploy. The schema after this migration must work with both the old and new code.
5. **Data backfill.** Separate migration or script, batched (for example 1,000 rows per batch, with a pause), resumable, idempotent, and never inside the schema migration's transaction.
6. **Rollback.** `down()` reverses the schema change. If data would be lost, say so and describe the restore path.
7. **Test locally.** Against the local MySQL container with synthetic data: `<migration-run-cmd>`, `<migration-revert-cmd>`, `<migration-run-cmd>` (commands from the CLAUDE.md table). Record the output.
8. **NestJS configuration check.** `TypeOrmModule.forRootAsync` options keep `synchronize: false` and `migrationsRun: false`. The migration is listed in the CLI data source (`src/database/data-source.ts` or the repository's equivalent), not only in the application module.
9. **Rollout note for the PR.** Migrations run through the TypeORM CLI as a one-off ECS task (`<migration-run-cmd>` in the release image) before the new service version starts. Never on application start, where several containers would run them at once.

## NestJS and TypeORM reference

Application configuration: migrations never run on start.

```ts
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    type: 'mysql',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USER', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_NAME', { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
  }),
});
```

CLI data source (`src/database/data-source.ts`), used only by the TypeORM CLI and the one-off migration task:

```ts
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
});
```

The release pipeline (not the AI) starts the one-off ECS task that runs `<migration-run-cmd>` against this data source, waits for it to succeed, then deploys the new service version.

## Evidence for the PR

```markdown
### Migration review
| Statement | Table (approx. rows) | Algorithm / lock | Backward compatible | Notes |
Metadata-lock risk: <low | medium: reason>
lock_wait_timeout set: yes/no
Local run: up ✔ down ✔ up ✔ (output attached)
Rollout: one-off ECS task before deploy | Backfill: <none | script + batch size>
```
