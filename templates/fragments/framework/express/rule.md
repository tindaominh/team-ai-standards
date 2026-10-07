---
paths:
  - "**/*.ts"
---

# Express

- Validate body, query and params with zod at the start of each handler or in a validation middleware.
- One error-handling middleware formats errors; async handlers pass rejections to it (Express 5 does this; Express 4 needs a wrapper).
- Routers stay thin: parse input, call a service, map the result. No data access in routers.
- Security headers, body size limits and timeouts are configured once when the app is created.
- Build the app in a factory (`createApp(deps)`) so tests can pass mocks.
