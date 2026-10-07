---
name: std-code-review
description: Use after implementation and verification, before the developer opens a PR. Runs a fresh-context review through the code-reviewer subagent and a second check on serious findings.
---

# Code review (fresh context)

## When to use

Before every PR, after the `std-verification` skill reports READY. Also on request for a branch someone else wrote.

## Steps

1. **Collect inputs** with read-only commands:
   - `git diff --stat origin/<base>...HEAD`
   - `git diff origin/<base>...HEAD`
   - the plan file path, if any.
   If the diff is larger than about 1,500 lines, split it by module and review each part separately.
2. **Delegate** to the `std-code-reviewer` subagent. Pass only: the diff, the changed file list, the plan path and a one-line ticket summary. Do not pass your own reasoning, explanations or opinions about the code; the reviewer must judge it independently.
3. If the change touches auth, credentials, webhooks, outbound HTTP, S3/files, IAM/infra or personal data, also delegate to `std-security-reviewer` with the same inputs.
4. **Second check on serious findings.** For each CRITICAL or HIGH finding, start a new `std-code-reviewer` run with only that finding and the relevant files, and ask: "Confirm or refute this finding with evidence." Keep findings that are confirmed. Mark refuted ones as "refuted" with the reason; do not silently drop them.
5. **Present the results** to the developer:
   - Confirmed findings by severity.
   - Refuted findings with reasons.
   - Questions.
   - The verdict.
6. Fix confirmed findings only after the developer agrees. Then re-run `std-verification` and repeat this review on the new diff.

## Evidence for the PR

```markdown
### AI review
Reviewer: code-reviewer (fresh context) [+ security-reviewer]
| Severity | Found | Confirmed | Fixed | Answered (not fixed, with reason) |
Verdict after fixes: OK TO OPEN PR
```

The AI review never replaces the human review. Never approve or merge on GitHub.
