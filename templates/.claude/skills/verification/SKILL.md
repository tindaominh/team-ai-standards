---
name: verification
description: Use before saying work is done and before code review. Runs build, typecheck, lint, tests and migration checks with the repository's own commands and produces a READY / NOT READY report with real output.
---

# Verification

## When to use

Before telling the developer a task is finished, before the `code-review` skill, and after fixing review findings.

## Steps

Take every command from the **Commands** table in CLAUDE.md (placeholders such as `<build-cmd>`). If a placeholder is not filled in, stop and ask the developer for the command; do not guess. Stop at the first failure, fix it (or report it), and start again from step 1.

1. Build: `<build-cmd>`
2. Typecheck: `<typecheck-cmd>`
3. Lint: `<lint-cmd>`
4. Unit tests: `<unit-test-cmd>`
5. Integration tests, if the change touches repositories, queries, transactions, migrations or adapters: `<integration-test-cmd>`
6. Migrations, if any were added: `<migration-show-cmd>`, then on the local database only: `<migration-run-cmd>`, `<migration-revert-cmd>`, `<migration-run-cmd>` (up → down → up).
7. Diff check: `git diff --stat origin/<base>...HEAD`. Confirm there are no unrelated files, no `.env*`, no debug code and no committed secrets or dumps.

## Report format

```markdown
### Verification
| Step | Command | Result | Evidence (last lines) |
| --- | --- | --- | --- |
| Build | <build-cmd as run> | PASS | `Successfully compiled` |
| Typecheck | <typecheck-cmd as run> | PASS | `0 errors` |
| Lint | <lint-cmd as run> | PASS | `0 problems` |
| Unit tests | <unit-test-cmd as run> | PASS | `Tests: 214 passed` |
| Integration | <integration-test-cmd as run> | SKIPPED | no DB-related change |
| Migrations | <migration-show-cmd as run> | N/A | |
| Diff | `git diff --stat ...` | PASS | 6 files, all in scope |
Status: READY FOR REVIEW | NOT READY (<reason>)
```

Rules:

- Evidence is copied from real output in this session, never written from memory.
- Write the command exactly as it was run, not the placeholder.
- SKIPPED needs a reason.
- Coverage numbers come from the test run output, not estimates.
