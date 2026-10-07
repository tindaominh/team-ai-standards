---
paths:
  - "**/*.ts"
---

# TypeScript style

- `strict` stays on. No `any` (use `unknown` and narrow), no `@ts-ignore`.
- Exported functions and public methods declare parameter and return types.
- `catch (err: unknown)`: narrow before use; rethrow with context (`cause`).
- HTTP input: class-validator DTOs with the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`). Other external data: validate with zod before use.
- Config: validated at startup by the zod env schema; read only through `ConfigService`.
- Use NestJS dependency injection; never `new` a service or repository.
- No floating promises.
- Money: integer minor units or a decimal library, never float arithmetic. Dates: UTC inside, converted at the edges.
- Use the repo logger, not `console`.
