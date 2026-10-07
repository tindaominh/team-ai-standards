# Raw driver: migrations

- Migrations are SQL (or code) files managed by the repository's migration tool (`<migration-generate-cmd>`, `<migration-run-cmd>` in the CLAUDE.md table). If the repository has no tool, stop and ask; do not apply SQL by hand.
- Each migration has a reviewed up and down step. Files that reached a shared environment are frozen.
- Statements that cannot run inside a transaction go in their own migration, marked as non-transactional in the tool's way.
- Configuration check: no code path runs migrations on application start.
