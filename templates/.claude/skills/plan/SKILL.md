---
name: plan
description: Use before implementing a change that touches more than 2 files, a database schema, a public API or a marketplace adapter. Produces an approved plan file; no code is edited until the developer approves.
---

# Plan

## When to use

- New feature, new channel adapter, schema change, public API or event change, cross-module refactor.
- Skip for single-file fixes with an obvious test; mention the skip in the PR.

## Steps

1. Read the ticket text the developer gives you. If key information is missing (acceptance criteria, affected channels, data volumes), ask before planning.
2. Delegate to the `planner` subagent with: the requirement, the ticket key, and the paths of modules likely involved. For small changes you may plan inline using the same output format.
3. Check the returned plan yourself:
   - Every task has a reference location and a proving command.
   - Database impact names the tables and their approximate size (ask the developer if unknown).
   - Data classification is filled in.
4. Save the plan to `docs/plans/<TICKET>-<slug>.md` (or the path in CLAUDE.md). Plans are committed with the PR unless the repository says otherwise.
5. Show the developer the plan summary and the open questions. Stop and wait for approval. Approval must be explicit ("approved", "go ahead"). Silence or a new unrelated question is not approval.
6. After approval, implement task by task with the `tdd-workflow` skill. If the plan turns out wrong, stop, update the plan file and ask again.

## Output

- The plan file path.
- A 5-line summary: goal, number of tasks, database impact, external API impact, open questions.
