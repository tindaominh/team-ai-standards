---
paths:
  - "**/*.ts"
---

# TypeORM and MySQL

- `synchronize` is `false` in every environment except a throwaway local test DB. Schema changes go through migrations only.
- Generate migrations with the TypeORM CLI, then read and edit them. Remove unintended DROP/ALTER statements. Every migration has a working `down()` or a note explaining why not.
- Never edit a migration that has run in any shared environment. Add a new one.
- Separate schema migrations from data backfills. Backfill in batches (e.g. 1,000 rows) with a resumable script.
- Large tables: state the expected DDL algorithm and lock (`ALGORITHM=INPLACE, LOCK=NONE` or `INSTANT`) and the metadata-lock risk in the PR. Use the `db-migration-review` skill.
- Multi-step writes (order conversion, stock reservation) run in one transaction: `dataSource.transaction()` or a `QueryRunner` with commit/rollback in `finally`.
- Use `update()`/`increment()` or explicit `WHERE` conditions for concurrent counters. Do not `find` + modify + `save` stock quantities.
- Every list query has a limit (`take`) and stable ordering. Fetch relations explicitly; watch for N+1.
- Use `SELECT ... FOR UPDATE` (pessimistic lock) or a version column when two workers may update the same row.
- If the repo uses NestJS: inject repositories with `@InjectRepository`, keep data access in providers, and register entities in the feature module.
