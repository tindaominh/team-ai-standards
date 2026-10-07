# Code quality

- Follow the existing structure and naming of the module you change. Consistency beats personal preference.
- Keep functions under about 50 lines and nesting at 3 levels or less; prefer early returns.
- Keep files focused; split a file when it passes about 400 lines or mixes responsibilities.
- Handle errors explicitly. Never swallow an error with an empty `catch` or a silent default. Rethrow with context or handle it and log.
- Use named constants for business values (timeouts, limits, status codes). No magic numbers.
- Do not leave `console.log`, commented-out code or TODOs without a ticket key (e.g. `TODO(PROJ-123)`).
- Change only what the task needs. Put unrelated refactors in a separate PR.
- Update docs, README or OpenAPI specs in the same PR when behaviour changes.
