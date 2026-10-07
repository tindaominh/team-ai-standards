# Optional hooks (team-ai-standard: managed file)

Hooks are **off by default** and **opt-in per repository**.

## The rule for team hooks

Team hooks may only **check** or **remind**. A team hook must never:

- write or modify files in the repository (including formatting them),
- write shared files (docs, CLAUDE.md, settings, anything committed),
- commit, push or change git state,
- call the network or download anything,
- send data off the machine,
- call an AI model or remote service.

Writing, formatting, committing and publishing happen through the developer, the repository's own scripts, or CI on a pull request. See `docs/en/09-docs-automation.md`.

## Hooks in this folder

| Hook | Event | What it does | Effect on Claude |
| --- | --- | --- | --- |
| `format-check-on-edit.cjs` | PostToolUse on `Edit`, `Write`, `MultiEdit` | Runs `node_modules/.bin/prettier --check <file>` on the edited file if it is inside the project, has a `.ts/.js/.json/.md/.yml/.yaml` extension and is not an `.env*` file. Does nothing if Prettier is not installed locally. | If the file is not formatted, adds a reminder next to the tool result (`additionalContext`). Never blocks. |
| `typecheck-on-stop.cjs` | Stop | Runs `node_modules/.bin/tsc --noEmit -p tsconfig.json` when Claude finishes a turn. Does nothing if `tsc` or `tsconfig.json` is missing. | On type errors, exits 2 with the first 30 lines, so Claude continues and fixes them. Runs once per stop cycle (`stop_hook_active` guard). |

Exactly what each hook touches:

- **Reads:** stdin JSON from Claude Code (`tool_input.file_path`, `cwd`, `stop_hook_active`) and the edited file or `tsconfig.json`.
- **Writes:** nothing. The formatter hook prints one JSON line on stdout for Claude Code; both print short messages on stderr.
- **Executes:** only the local `prettier` or `tsc` binary in `node_modules/.bin`. No `npx`, no shell, no network.
- **Environment:** reads only `CLAUDE_PROJECT_DIR`.

The files use the `.cjs` extension so they run the same in CommonJS and ES-module projects.

## Enable in a repository

The hook scripts are installed with the standard in `.claude/std/hooks/` but do nothing until the repository turns them on:

1. Set `"hooks": true` in `.claude/project.json`.
2. Run `node .claude/std/compose-settings.mjs`; it adds the `hooks` block to `.claude/settings.json`.
3. Read both scripts before the PR. They are short on purpose.
4. Mention the change in the PR. It is reviewed like code.

## Disable

Set `"hooks": false` in `.claude/project.json` and run the same command. Developers can also turn hooks off temporarily in their own `.claude/settings.local.json`.

## Rules for adding new hooks

- Follows "The rule for team hooks" above.
- Deterministic; uses only tools already installed in the project.
- Exits 0 on unexpected errors, so a broken hook never blocks work.
- Under 100 lines, with a header comment saying what it reads, writes and runs.
- Approved by the owner of the standard before it is added here.
