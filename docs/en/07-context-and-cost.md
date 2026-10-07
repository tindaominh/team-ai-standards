# 07. Context and cost

## Purpose

Everything the AI loads into its context costs money and attention. A small, focused context gives better answers and lower cost. This document says where each kind of instruction belongs and how to run sessions efficiently.

## What goes where

| Place | Loaded | Put here | Keep out |
| --- | --- | --- | --- |
| `CLAUDE.md` (repository root) | Every session | What the service does, layout, exact commands, architecture in a few lines, repository-specific hard rules, links | Long explanations, tutorials, anything already in rules or skills |
| `.claude/rules/common/*.md` | Every session | Short, checkable team rules that apply to all work | Procedures and examples (put them in skills) |
| `.claude/rules/typescript/*.md`, `.claude/rules/common/aws.md` | When matching files are read or edited (`paths:`) | Rules for a file type or area | General rules |
| `.claude/skills/<name>/SKILL.md` | Description always; body only when used | Step-by-step procedures with output formats (plan, TDD, review, verification, migration review) | Rules that must always apply |
| `.claude/agents/*.md` | Description always; body only in the subagent | Roles that need a fresh context and limited tools | Anything the main session needs |
| `docs/` (this standard, ADRs, runbooks) | Only when someone asks the AI to read them | Explanations for humans | Instructions the AI must always follow |

`common/marketplace-integration.md` is always loaded for now, because most of our work touches channel adapters. If the budget becomes tight after the pilot, it can be path-scoped to the integration folders (for example `src/channels/**`, `src/orders/**`, `src/stock/**`).

## Size limits

| Item | Limit |
| --- | --- |
| Always loaded: CLAUDE.md + rules without `paths:` + skill and agent descriptions | 2,300 words (about 3,000 tokens) |
| Worst case: always loaded + all path-scoped rules (TypeScript, AWS) | 2,300 words |
| CLAUDE.md alone | 150 lines |
| One rule file | 60 lines |
| One skill | 150 lines |
| One agent | 120 lines |
| Agent or skill description | 40 words |
| Skills per repository | 6 from the team set + at most 2 repository-specific |

In the standard repository, `npm run check:budget` measures the templates and fails if either limit is exceeded; CI runs it on every change. The 0.2.0 templates measure about 1,790 words always loaded and about 2,210 words in the worst case. Rules hold short, checkable statements; code examples belong in skills, which load only when used. In a project repository, measure with `wc -w CLAUDE.md .claude/rules/*/*.md` and multiply by about 1.3 for tokens.

## Writing good instructions

- One instruction per line, stated as something checkable ("every list query has a limit"), not as an aspiration ("write efficient queries").
- No duplicates between CLAUDE.md, rules and skills. If two places say the same thing, delete one.
- Prefer machine enforcement: if ESLint, TypeScript, commitlint or CI can check it, configure the tool instead of writing a rule.
- Remove rules the team no longer needs. Review at each standard release.

## Session hygiene

- **One task per session.** Start a new session or `/clear` when switching tickets.
- **Plan file first.** For longer work, keep the plan in a file. It survives `/clear` and `/compact`.
- **Compact at boundaries.** Use `/compact` after planning, after a large investigation, or after finishing a task, never in the middle of an edit. Write open items to the plan file first.
- **Delegate wide searches.** Use a subagent for broad code exploration so the main session receives only the conclusion.
- **Point, don't paste.** Give file paths and line numbers instead of pasting large files or logs.
- **Short logs.** When sharing test or build output, give the failing part, not thousands of lines.
- **Stop loops early.** If the AI tries the same fix twice without progress, stop, re-read the error yourself and give a new direction.

## Model choice

| Work | Model tier |
| --- | --- |
| Planning and architecture questions, tricky debugging | Most capable model (agent `planner` uses it) |
| Everyday implementation, tests, reviews | Balanced model (default; reviewers use it) |
| Simple, repetitive edits, summaries | Smallest model, when available and approved |

Change the model only if the result is not good enough. A larger model is not a substitute for a clear task and a good plan.

## Cost awareness

- Large contexts, repeated full-file reads and long sessions drive cost. Session hygiene is the main lever.
- Extensions that add many skills, agents or rules increase the cost of every session. Count this in the evaluation (05).
- Wave champions report usage and cost per developer during the pilot (see 08). We use the numbers to set guidance, not to blame individuals.
- Local session history is kept for 14 days (`cleanupPeriodDays` in our settings), to limit how long client code stays on disk.
