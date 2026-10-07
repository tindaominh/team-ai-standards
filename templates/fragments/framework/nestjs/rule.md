---
paths:
  - "**/*.ts"
---

# NestJS

- HTTP input: class-validator DTOs with the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
- Config is read only through `ConfigService`; `ConfigModule` validates it with the zod env schema.
- Use dependency injection; never `new` a service, repository or client.
- Controllers stay thin: no data access, no business rules; providers (services) do the work.
