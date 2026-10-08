When to use: for each ticket, at the start of a new session.

Ticket <PROJ-123>: <title>.
Goal: <one or two sentences>.
Acceptance criteria:

- <criterion 1>
- <criterion 2>

Follow the full loop and stop at each approval point:

1. `std-plan`: a short plan for this ticket. Wait for my approval.
2. `std-tdd-workflow`: write the failing test first and show the RED output (the test fails for the right reason), then the code, then GREEN.
3. `std-verification`: run it until it reports READY, and show the report.
4. `std-code-review` in a fresh context (a subagent), plus `std-security-review` or `std-db-migration-review` when they apply. Fix or answer every CRITICAL and HIGH finding.
5. Write the pull request body from `.github/pull_request_template.md`, with the evidence it asks for.

Do not run git commands that write (commit, push, branch, merge, rebase); I do those. Never read `.env` or paste secrets or customer data.
