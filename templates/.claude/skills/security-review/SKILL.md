---
name: security-review
description: Use when a change touches auth, credentials, webhooks, outbound HTTP, S3 or files, IAM or infrastructure, or personal data. Runs the security-reviewer subagent and local, offline dependency checks.
---

# Security review

## When to use

- Any change in the trigger areas above.
- Adding or upgrading dependencies.
- Before a first release of a new channel adapter.

## Steps

1. Collect the diff and changed files as in the `code-review` skill.
2. Delegate to the `security-reviewer` subagent with only those inputs.
3. If `package.json` or the lockfile changed, run `npm audit --omit=dev` and report HIGH/CRITICAL advisories with package names and paths. Ask before running any fix command.
4. For infra changes, compare the diff against the AWS rule (`.claude/rules/common/aws.md`) and list each item as OK, violated or not applicable.
5. Run the repository's secret scan script if CLAUDE.md lists one. Never print matched values; report file and line only.
6. Present findings to the developer by severity. For a CRITICAL finding involving an exposed secret: tell the developer immediately, do not try to rotate or revoke anything yourself, and point to the incident steps in the team security guidelines.

## AWS quick checks

- Task role: specific actions and ARNs, no `*:*`.
- Secrets: ECS `secrets`, not `environment`.
- RDS: private, encrypted, deletion protection, backups.
- S3: Block Public Access, encryption, no personal data in keys.
- CloudWatch: retention set, no personal data in log lines.
- CI: OIDC role, no static keys.

## Evidence for the PR

```markdown
### Security review
Triggered by: <area>
| Severity | Count | Status |
npm audit (prod deps): <0 high, 0 critical | details>
Infra checklist: <n/a | all OK | items>
```
