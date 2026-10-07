---
paths:
  - "**/*.ts"
---

# Raw database driver (mysql2 / pg)

- Every query is parameterised (`?` for mysql2, `$1` for pg). Never build SQL from input.
- One pool per process, created at startup and closed on shutdown. A client taken from the pool is released in `finally`.
- Multi-step writes run in one explicit transaction on one connection (`BEGIN` … `COMMIT`, `ROLLBACK` on error).
- SQL lives only in the data-access layer, which maps rows to typed objects.
- Schema changes only through the repository's migration tool, as reviewed SQL, run as a one-off task before deploy.
- Every list query has `LIMIT` and `ORDER BY`. Counters use a single guarded `UPDATE`.
