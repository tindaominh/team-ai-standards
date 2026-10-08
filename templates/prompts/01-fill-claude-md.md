When to use: right after adoption, when `CLAUDE.md` still has `TODO(adopt)` items. Replace each `<placeholder>` before sending.

We are filling in `CLAUDE.md` for the repository <repository-name>. Interview me first, then propose the text.

1. Read `CLAUDE.md`, `.claude/project.json` and the folder layout. Do not read `.env` or any secret.
2. Ask me one question at a time, at most 10 in total, and wait for each answer. Cover: purpose, users, main flows, architecture, external systems (APIs, marketplaces, queues), data classification (internal, client code, personal data), environments, local setup, non-goals. Skip a question when the repository already answers it.
3. Then propose the filled `TODO(adopt)` sections as one diff of `CLAUDE.md` and wait for my approval before writing.

Rules:

- Change only text outside the `<!-- std:begin ... -->` / `<!-- std:end ... -->` blocks. Never edit standard files: `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, `.claude/settings.json`.
- Keep `CLAUDE.md` short: facts Claude needs in every session. Put detail in `docs/` and link to it. Longer project rules go in `.claude/rules/local/`.
- Where I do not know an answer, leave `TODO(adopt): <what is missing>` instead of guessing.
