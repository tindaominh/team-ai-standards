---
name: std-db-migration-review
description: Use when a change adds or edits a database migration, entity or model column, index or relation. Checks lock behaviour, rollout order and rollback before the PR.
---

# Database migration review

Before step 1, read the files next to this skill (only the ones for this repository's stack are installed):

- `database-*.md`: how each of this repository's database engines executes DDL, and which locks it takes.
- `data-access-*.md`: how this repository creates, configures and runs migrations.

## When to use

Any new migration file, any entity change that requires one, any data backfill.

## Steps

1. **Read the generated SQL.** Open the migration and list every statement. Remove anything unrelated to the task; generators sometimes emit DROP/ADD for renames or for type, charset or default differences.
2. **Classify each statement** with the table in the matching `database-*.md`. Write down the expected lock and whether the table is rewritten.
3. **Locks and timeouts.** DDL waits for open transactions on the table and blocks new queries while it waits. Check for long-running jobs on that table (sync workers, reports). Set the session timeout described in `database-*.md` so the migration fails instead of stalling traffic.
4. **Backward compatibility.** The old application version keeps running during an ECS rolling deploy. The schema after this migration must work with both the old and the new code. Renames and type changes use expand–contract: add new, dual-write, backfill, switch reads, drop old.
5. **Data backfill.** Separate migration or script, batched (for example 1,000 rows per batch, with a pause), resumable, idempotent, and never inside the schema migration's transaction.
6. **Rollback.** `down()` reverses the schema change. If data would be lost, say so and describe the restore path.
7. **Test locally.** Against the local database container with synthetic data: `<migration-run-cmd>`, `<migration-revert-cmd>`, `<migration-run-cmd>` (commands from the CLAUDE.md table). Record the output.
8. **Configuration check.** As described in `data-access-*.md`: migrations never run on application start, and the new migration is picked up by the migration tool.
9. **Rollout note for the PR.** Migrations run through the migration tool as a one-off ECS task (`<migration-run-cmd>` in the release image) before the new service version starts. The release pipeline starts that task, not the AI. Never on application start, where several containers would run them at once.

## Evidence for the PR

```markdown
### Migration review
| Statement | Table (approx. rows) | Lock / rewrite | Backward compatible | Notes |
Lock-wait risk: <low | medium: reason>
Session timeout set: yes/no
Local run: up ✔ down ✔ up ✔ (output attached)
Rollout: one-off ECS task before deploy | Backfill: <none | script + batch size>
```
