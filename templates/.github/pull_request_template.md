<!-- team-ai-standard: managed file. Update through the standard, not in this repository. -->

## Summary

<!-- What changes and why. One paragraph. -->

Ticket: <PROJ-123>
Plan: <docs/plans/PROJ-123-slug.md | not needed: reason>
AI assistance: <none | used for planning / tests / implementation / review>

## Test evidence

<!-- Failing run before the change, passing run after. Real output only. -->

| Task | Test | Before (failing) | After (passing) |
| --- | --- | --- | --- |
| | | | |

Full suite: <command> → <result>
Known gaps: <none | list>

## Verification

<!-- Commands come from the Commands table in CLAUDE.md. Write them as run. -->

| Step | Command | Result |
| --- | --- | --- |
| Build | | |
| Typecheck | | |
| Lint | | |
| Unit tests | | |
| Integration tests | | |
| Migrations | | |

## AI review

<!-- Fresh-context reviewer results. Delete if AI was not used. -->

| Severity | Found | Confirmed | Fixed | Answered (with reason) |
| --- | --- | --- | --- | --- |
| CRITICAL | | | | |
| HIGH | | | | |

Security review: <not triggered | triggered by: area, result>
Migration review: <no migration | attached>

## Regression guard (bug fixes)

<!-- Required for every bug fix. Reviewers block a bug-fix PR that leaves this empty. Delete only if the PR fixes no bug. -->

What now prevents this bug from coming back: <a test (name/path), a CI step, a lint rule, a type, a constraint | none possible: reason>

## Checklist

- [ ] No secrets, `.env*`, dumps or real customer data in the diff, tests or description.
- [ ] Tests fail without the change and pass with it.
- [ ] Docs / OpenAPI / runbook updated if behaviour changed.
- [ ] Migration is backward compatible with the running version (if any).
- [ ] I have read and understood every line of this diff, including AI-written lines.
