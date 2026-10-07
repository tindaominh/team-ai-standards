---
paths:
  - "**/*.ts"
---

# PostgreSQL

- Indexes on large tables: `CREATE INDEX CONCURRENTLY`, in a migration that does not run inside a transaction.
- New constraints on large tables: `NOT VALID`, then `VALIDATE CONSTRAINT` separately.
- Migrations set a short `lock_timeout`.
- Money `numeric`; timestamps `timestamptz`.
