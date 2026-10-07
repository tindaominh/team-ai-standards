---
paths:
  - "**/*.ts"
---

# TypeScript style

- `strict` mode stays on. No `any`; use `unknown` and narrow it. No `@ts-ignore`; `@ts-expect-error` only with a reason.
- Exported functions and public methods declare parameter and return types.
- Use `interface` for object shapes and `type` for unions. Prefer string-literal unions or `as const` objects over `enum` in new code, unless the module already uses enums.
- In `catch (err: unknown)`, narrow before use. Wrap and rethrow domain errors with context (`cause`).
- Parse external data with a schema (zod or class-validator, whichever the repo uses) and work with the parsed type.
- Always `await` or return promises. No floating promises. Use `Promise.allSettled` when partial failure is acceptable.
- Money: integer minor units or a decimal library. Never `number` arithmetic on prices.
- Dates: store UTC, convert at the edges. Use the repo's date library.
- Use the repo logger, not `console`.
