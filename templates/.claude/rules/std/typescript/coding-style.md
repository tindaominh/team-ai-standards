---
paths:
  - "**/*.ts"
---

# TypeScript style

- `strict` stays on. No `any` (use `unknown` and narrow), no `@ts-ignore`.
- Exported functions and public methods declare parameter and return types.
- `catch (err: unknown)`: narrow before use; rethrow with context (`cause`).
- Validate all external data before use. Config is validated at startup by the zod env schema.
- No floating promises.
- Money: integer minor units or a decimal library, never float arithmetic. Dates: UTC inside, converted at the edges.
- Use the repo logger, not `console`.
