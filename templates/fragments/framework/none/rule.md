---
paths:
  - "**/*.ts"
---

# Node.js service without a web framework

- One config module parses `process.env` with the zod env schema at startup; other code imports the typed config.
- Pass dependencies (pools, clients, repositories) through constructors or factories; no singletons created at import time.
- Validate every external message (queue, webhook, file) with zod before use.
- On `SIGTERM`, stop taking work, finish or release in-flight work, and close pools.
