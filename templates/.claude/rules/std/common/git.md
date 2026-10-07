# Git

- Branch: `<type>/<TICKET>-<short-slug>`, for example `feat/PROJ-123-shopee-stock-sync`.
- Commit messages: Conventional Commits, checked by commitlint. Put the Backlog key in the footer: `Refs: PROJ-123`.
- The developer decides when to commit. Propose a message; do not commit unless asked and allowed by this repository's settings.
- Never push, force-push, rebase shared branches, reset --hard, or merge. These belong to humans.
- Compare against the base branch with `git diff origin/<base>...HEAD`, not `HEAD~1`.
