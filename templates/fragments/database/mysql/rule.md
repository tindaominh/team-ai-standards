---
paths:
  - "**/*.ts"
---

# MySQL

- DDL on large tables states the expected `ALGORITHM`/`LOCK`; a table rebuild needs an agreed plan.
- Migrations set a short `lock_wait_timeout`.
- Money `DECIMAL`; timestamps UTC; character set `utf8mb4`.
