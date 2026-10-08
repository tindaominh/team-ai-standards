When to use: path b of doc 12 only — the standard was adopted in an empty repository and the application does not exist yet.

Scaffold the application for <repository-name> with the official CLI, under the rules of this repository.

Stack: <for example NestJS + MySQL + TypeORM, pnpm>. Extra packages: <for example @nestjs/config zod>.

1. Read `CLAUDE.md` and `.claude/project.json`. Follow `.claude/rules/`.
2. Propose the exact commands first (for example `pnpm dlx @nestjs/cli new . --package-manager pnpm --skip-git`, then `pnpm add ...`) and wait for my approval. Use the official CLI; do not write the skeleton by hand.
3. Do not overwrite `CLAUDE.md`, `.claude/`, `.github/` or `.gitignore` entries the standard added; if the CLI wants to, stop and tell me.
4. Do not run git commands that write.
5. When the skeleton builds, stop. Tell me to commit it and re-run adoption (`node <path-to-standard>/scripts/adopt.mjs --dry-run`, then `--yes`) so the command list in `.claude/project.json` and `CLAUDE.md` is filled from `package.json`.
