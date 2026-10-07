---
# Copy this file to templates/fragments/<folder>/<value>/rule.md and delete these comment lines.
# <folder> is framework, database, data-access or optional (see fragments.json).
# Keep `paths:` so the rule loads only when matching files are read or edited.
paths:
  - "**/*.ts"
---

# <Name of the framework, database or library>

- <One short, checkable statement per line. What must always be true in code that uses it.>
- <Prefer statements a reviewer can verify in a diff: "every list query has LIMIT", not "write efficient queries".>
- <No code examples here: they go in tdd.md or migration.md next to this file and load only with the skill.>
- <At most 150 words in total below the front matter; npm run check:budget fails above that.>
