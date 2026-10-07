# 11. Adding a stack fragment

## Purpose

A fragment teaches the AI one part of a repository's stack: a framework, a database, a data-access library, or an optional area such as AWS. Repositories combine fragments, so adding one value (for example Koa, or Kysely) does not multiply files. This document is for whoever extends the standard; developers who only adopt it do not need it.

## How fragments work

| File in `templates/fragments/<folder>/<value>/` | Installed in a project repository as | Loaded |
| --- | --- | --- |
| `rule.md` (required) | `.claude/rules/std/fragments/<folder>-<value>.md` | When files matching its `paths:` are read or edited |
| `tdd.md` (optional) | `.claude/skills/std-tdd-workflow/<folder>-<value>.md` | Only when the TDD skill runs |
| `migration.md` (optional) | `.claude/skills/std-db-migration-review/<folder>-<value>.md` | Only when the migration review skill runs |

- `<folder>` is `framework`, `database`, `data-access` or `optional`.
- The registry `templates/fragments/fragments.json` lists the allowed values, their labels, the dependencies that detect them, and template variables (for example `DB_TYPE` for databases).
- `adopt.mjs` and the update job install exactly the fragments selected in the repository's `.claude/project.json`, and remove fragments that are no longer selected.
- Template variables such as `{{DB_LABEL}}`, `{{DB_TYPE}}` and `{{DB_PORT}}` are filled from the selected databases.

## Steps

1. **Register the value** in `templates/fragments/fragments.json`, under the right dimension: a `label`, the `detect` dependency names (a trailing `/*` matches a scope such as `@aws-sdk/*`), and for a database its `vars`. Use `outranks` when one dependency usually brings another (as NestJS does with Express). If the dependency is in the `unsupported` list, remove it from there.
2. **Write the rule** from `templates/fragments/_TEMPLATE.md` into `templates/fragments/<folder>/<value>/rule.md`:
   - keep the `paths:` front matter;
   - short, checkable statements only, one per line;
   - **at most 150 words** below the front matter;
   - nothing that another dimension already says (for example, a framework fragment says nothing about migrations).
3. **Put examples in the skills, not the rule.** Code that shows how to build a class under test, mock data access or write a transaction goes in `tdd.md`. How migrations are created, configured and run goes in `migration.md`. They load only when the skill runs, so they do not count against the context budget.
4. **Check combinations.** If the new value cannot work with some others, add the rule to `validate()` in `scripts/lib/standard.mjs` (an error for impossible combinations, a warning for unusual ones).
5. **Add tests** in `scripts/smoke-test.mjs`:
   - detection: a `package.json` with the new dependency selects the new value;
   - ambiguity: if it can clash with an existing value, detection stops and names both;
   - installation: adopting with the new flag installs the rule (and skill files) with no `{{…}}` left;
   - sync: switching to and from the new value adds and removes its files.
6. **Run the checks:** `npm run check`. The budget check computes every valid combination; the largest one must stay at or below 2,300 words, and every fragment rule at or below 150 words.
7. **Document it:** add the value to the flags table in doc 10 and to `docs/vi/ai-files-explained.md`, and note it in `CHANGELOG.md` (a new fragment is a MINOR change).

## Review checklist for a new fragment

- [ ] Registered in `fragments.json` with detection that cannot silently pick the wrong value.
- [ ] `rule.md` has `paths:` and at most 150 words of checkable statements.
- [ ] Examples are in `tdd.md` / `migration.md`, not in the rule.
- [ ] Impossible combinations are rejected in `validate()`.
- [ ] Smoke tests cover detection, ambiguity, installation and sync.
- [ ] `npm run check` passes; the reported worst combination is within the budget.
- [ ] Doc 10, `ai-files-explained.md` and the CHANGELOG are updated.
