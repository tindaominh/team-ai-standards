# PostgreSQL: DDL behaviour

| Statement | Typical PostgreSQL behaviour | Action |
| --- | --- | --- |
| Add nullable column, or with a constant default | metadata only (fast) | Fine; a volatile default (for example `now()` per row) rewrites the table |
| Create index | `CREATE INDEX` blocks writes | Use `CREATE INDEX CONCURRENTLY` in its own migration that does not run inside a transaction (see the data-access file for how) |
| Change column type | usually a full table rewrite under `ACCESS EXCLUSIVE` | Expand–contract |
| Set NOT NULL on a big table | full scan under `ACCESS EXCLUSIVE` | Add `CHECK (col IS NOT NULL) NOT VALID`, then `VALIDATE CONSTRAINT` in a separate migration |
| Add foreign key | validates all rows while holding locks | Add with `NOT VALID`, then `VALIDATE CONSTRAINT` separately |
| Drop column / table | metadata change, irreversible data loss | Only after code stopped using it (contract step), with backup confirmed |
| Rename column | breaks old code during rollout | Expand–contract |

Session timeout: start the migration with `SET lock_timeout = '5s'` and a `statement_timeout` that fits the change, so it fails instead of queueing all traffic behind its lock.

Types: money as `numeric(p,s)`, timestamps as `timestamptz`, IDs as `bigint` or `uuid`. Worker queues: `SELECT ... FOR UPDATE SKIP LOCKED`.
