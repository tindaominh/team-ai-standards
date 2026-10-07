# Optional hooks

Hooks are **off by default** and **opt-in per repository**. They are deterministic checks that run on your machine. They make no network calls, download nothing, and read nothing outside the project.

| Hook | Event | What it does | Can it block? |
|---|---|---|---|
| `format-on-edit.js` | PostToolUse on `Edit`, `Write`, `MultiEdit` | Runs `node_modules/.bin/prettier --write <file>` on the edited file if it is inside the project, has a `.ts/.js/.json/.md/.yml/.yaml` extension and is not an `.env*` file. Does nothing if Prettier is not installed locally. | No (always exits 0) |
| `typecheck-on-stop.js` | Stop | Runs `node_modules/.bin/tsc --noEmit -p tsconfig.json` when Claude finishes a turn. On errors it prints the first 30 lines and exits 2, so Claude continues and fixes them. It runs once per stop cycle (uses `stop_hook_active` to avoid loops). Does nothing if `tsc` or `tsconfig.json` is missing. | Yes, once, on type errors |

Exactly what each hook touches:

- **Reads:** stdin JSON from Claude Code (`tool_input.file_path`, `cwd`, `stop_hook_active`), and the file paths above.
- **Writes:** only the edited file, rewritten in place by Prettier.
- **Executes:** only the two local binaries in `node_modules/.bin`. No `npx`, no shell.
- **Environment:** reads only `CLAUDE_PROJECT_DIR`.

## Enable in a repository

1. Copy `format-on-edit.js` and `typecheck-on-stop.js` to `<repo>/.claude/hooks/`.
2. Merge the `hooks` block from `settings.hooks.example.json` into `<repo>/.claude/settings.json`.
3. Read both scripts before committing them. They are short on purpose.
4. Mention the change in the PR. Hook changes are reviewed like code.

## Disable

Remove the `hooks` block from `.claude/settings.json`. Developers can also turn hooks off temporarily in their own `.claude/settings.local.json`.

## Rules for adding new hooks

- Deterministic only. A hook never calls an AI model or a remote service.
- Uses only tools already installed in the project.
- Exits 0 on unexpected errors, so a broken hook never blocks work.
- Under 100 lines, with a header comment saying what it reads, writes and runs.
- Approved by the owner of the standard before it is added here.
