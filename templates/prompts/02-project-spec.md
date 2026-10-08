When to use: after prompt 01, when the project needs a written specification that Claude reads at the start of each session.

Write `docs/PROJECT_SPEC.md` for <repository-name> from our interview and these notes: <paste notes, links to tickets or documents>.

Sections: Goals, Non-goals, Constraints (client, security, data, performance, deadlines), Architecture, Data (entities, classification, retention), Phases (milestones with a short outcome each), Open questions.

Rules:

- Use only what I said or wrote; mark anything assumed as "Assumption:" and list it under Open questions.
- Keep it to what a developer needs to make decisions; no marketing text.
- Add one line `@docs/PROJECT_SPEC.md` to the Project section of `CLAUDE.md` (outside the `std:` blocks) so the spec is imported.
- Show me the file and the `CLAUDE.md` change, and wait for my approval before writing.
