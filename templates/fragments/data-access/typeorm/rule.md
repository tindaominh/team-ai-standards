---
paths:
  - "**/*.ts"
---

# TypeORM

- `synchronize` and `migrationsRun` are `false` outside a throwaway test database.
- With NestJS: modules register entities with `TypeOrmModule.forFeature`; providers inject repositories with `@InjectRepository`.
- Multi-step writes run in one transaction inside a service (`dataSource.transaction` or a `QueryRunner` that is always released). Inside it, use only its manager.
- Schema changes only through reviewed TypeORM CLI migrations, each with a working `down()` or a stated reason. A migration that reached a shared environment is frozen; fix forward.
- Migrations run as a one-off task before deploy, never on application start.
- Counters such as stock: guarded `update`/`increment`, a row lock, or a version column. Never read, modify, then `save`.
- Every list query has `take` and a stable `order`; relations are loaded explicitly.
