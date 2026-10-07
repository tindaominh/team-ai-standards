# MySQL 8: DDL behaviour

| Statement | Typical MySQL 8 behaviour | Action |
| --- | --- | --- |
| Add nullable column / column with default (at end) | often `INSTANT` | State `ALGORITHM=INSTANT` where supported |
| Add secondary index | `INPLACE`, `LOCK=NONE` | Fine online; check disk and time for big tables |
| Change column type, shorten length, change charset | `COPY` (table rebuild, writes blocked) | Expand–contract or an online schema tool, agreed with ops |
| Add NOT NULL without default to existing rows | rebuild or failure | Add nullable → backfill → add constraint |
| Drop column / table | metadata change, irreversible data loss | Only after code stopped using it (contract step), with backup confirmed |
| Add foreign key | may lock or scan | Check the index on the child column; consider an application-level check |
| Rename column | breaks old code during rollout | Expand–contract |

When the expected algorithm and lock matter, write them in raw SQL (`ALTER TABLE ... , ALGORITHM=INPLACE, LOCK=NONE`). MySQL then fails fast instead of silently copying the table.

Session timeout: every `ALTER` needs a metadata lock. Start the migration with `SET SESSION lock_wait_timeout = 5` so it fails instead of queueing all traffic behind it.

Types: money as `DECIMAL(p,s)`, timestamps in UTC (`DATETIME(3)` or `TIMESTAMP`), character set `utf8mb4`.
