---
name: verification
description: Use before saying work is done and before code review. Runs build, typecheck, lint, tests and migration checks with the repository's own commands and produces a READY / NOT READY report with real output.
---

# Verification

## When to use

Before telling the developer a task is finished, before the `code-review` skill, and after fixing review findings.

## Steps

Run each command from the CLAUDE.md command table. Stop at the first failure, fix it (or report it), and start again from step 1.

1. Build: `npm run build`
2. Typecheck: `npm run typecheck`
3. Lint: `npm run lint`
4. Unit tests: `npm test`
5. Integration tests, if the change touches repositories, queries, migrations or adapters: `npm run test:integration`
6. Migrations, if any were added: `npm run migration:show`, and confirm the new migration runs `up` then `down` then `up` on the local database.
7. Diff check: `git diff --stat origin/<base>...HEAD`. Confirm there are no unrelated files, no `.env*`, no debug code and no committed secrets or dumps.

## Report format

```markdown
### Verification
| Step | Command | Result | Evidence (last lines) |
|---|---|---|---|
| Build | `npm run build` | PASS | `Successfully compiled` |
| Typecheck | `npm run typecheck` | PASS | `0 errors` |
| Lint | `npm run lint` | PASS | `0 problems` |
| Unit tests | `npm test` | PASS | `Tests: 214 passed` |
| Integration | `npm run test:integration` | SKIPPED | no DB-related change |
| Migrations | `npm run migration:show` | N/A | |
| Diff | `git diff --stat ...` | PASS | 6 files, all in scope |
Status: READY FOR REVIEW | NOT READY (<reason>)
```

Rules:
- Evidence is copied from real output in this session, never written from memory.
- SKIPPED needs a reason.
- Coverage numbers come from the test run output, not estimates.
