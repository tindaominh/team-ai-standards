# Changelog

All notable changes to this standard are recorded here. Versions follow `MAJOR.MINOR.PATCH` (see docs/en/08-adoption-plan.md).

## [0.1.0] - 2026-10-07

### Added

- Human-facing documents in English and Vietnamese (`docs/en`, `docs/vi`):
  - 01 AI usage policy
  - 02 development workflow
  - 03 roles and responsibilities
  - 04 PR review checklist
  - 05 security guidelines
  - 06 LLM-in-product pattern
  - 07 context and cost
  - 08 adoption plan
- `docs/vi/ai-files-explained.md`.
- Repository templates:
  - `CLAUDE.md`
  - `.claude/settings.json` (strict profile, default for client repositories)
  - `.claude/settings.standard.json` (internal repositories)
  - rules (common, TypeScript, TypeORM, marketplace integration, AWS)
  - subagents (`planner`, `code-reviewer`, `security-reviewer`)
  - six skills (`plan`, `tdd-workflow`, `verification`, `code-review`, `security-review`, `db-migration-review`)
  - GitHub PR template
- Optional, opt-in hooks: format on edit, typecheck on stop.
