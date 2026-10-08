When to use: before the first line of application code, to plan the first milestone in plan mode.

Plan the first milestone of <repository-name>: <milestone, for example "orders can be imported from <marketplace>">.

1. Read `CLAUDE.md` and `docs/PROJECT_SPEC.md` (if it exists).
2. Use the `std-plan` skill. Split the milestone into phases, each small enough for one pull request:
   - Phase 0: setup — project skeleton, configuration validated at startup, lint, typecheck and test commands, CI, local environment (database in Docker, `config/env.example`).
   - Later phases: one slice of behaviour each, with its tests and acceptance criteria.
3. For each phase: goal, files or modules touched, tests to write first, risks, and what a reviewer checks.
4. Save the plan as `docs/plans/<yyyy-mm-dd>-<milestone-slug>.md`.
5. Stop and wait for my approval. Do not write application code in this session.
