# 10. Versioning and distribution of the standard

## Purpose

How this standard is versioned and released, and how project repositories adopt a new version without anyone pushing changes into them directly.

## 1. Version numbers

The standard uses semantic versioning: `MAJOR.MINOR.PATCH`. The version lives in three places that must match: `package.json`, `templates/.claude/STANDARD_VERSION` and the latest heading in `CHANGELOG.md`.

| Change | Level | Examples |
| --- | --- | --- |
| Developers or repositories must act differently, or a template change can break an adopted repository | **MAJOR** | New mandatory workflow step; stricter data policy; a permission removed from `allow`; renamed placeholders |
| Something new or stricter that does not break adopted repositories | **MINOR** | New rule, skill, doc or optional workflow; new deny rule; new placeholder with a safe default |
| Wording, typos, examples, clarifications with no change in meaning | **PATCH** | Fix a broken link; better Vietnamese wording |

While the major version is `0`, minor releases may contain breaking changes; they are marked **Breaking** in the CHANGELOG.

## 2. CHANGELOG discipline

- Every PR to this repository adds a line under `## [Unreleased]` in `CHANGELOG.md`, in one of: Added, Changed, Removed, Fixed, Security.
- Each line says what changed and, if needed, what adopted repositories must do (for example "replace `<unit-test-cmd>` in settings").
- Breaking changes start with **Breaking:**.
- At release time, `[Unreleased]` becomes `[x.y.z] - YYYY-MM-DD`.
- English and Vietnamese documents change in the same PR; CI checks that their structure matches.

## 3. Releasing

1. The owner of the standard opens a release PR: version bump in `package.json` and `templates/.claude/STANDARD_VERSION`, CHANGELOG heading dated.
2. CI (`standard-ci`) passes: lint, JSON, settings, parity, budget, smoke tests.
3. After merge, the owner creates an annotated tag on `main`: `git tag -a v0.2.0 -m "Team AI standard 0.2.0"` and pushes it.
4. The owner creates a GitHub release from the tag, with the CHANGELOG section as release notes.
5. The tag starts the update job (next section).

Release cadence: after each wave retrospective during the rollout, then quarterly, and immediately for security fixes.

## 4. How project repositories record the version

- Each repository has `.claude/STANDARD_VERSION` containing the version it uses (for example `0.2.0`).
- `CLAUDE.md` refers to that file instead of repeating the number.
- The pilot and later waves report which version each repository is on.

## 5. Update pull requests

Workflow: `.github/workflows/standard-update.yml` in this repository, with `scripts/sync-standard.mjs`. Target repositories are listed in `.github/standard-targets.json`:

```json
{
  "targets": [
    { "repo": "<org>/<order-sync-service>", "profile": "standard", "baseBranch": "main" },
    { "repo": "<org>/<client-x-adapter>", "profile": "strict", "baseBranch": "develop", "enabled": false }
  ]
}
```

When a release tag is pushed, for each enabled target the job:

1. Checks that the tag, `package.json` and `STANDARD_VERSION` agree.
2. Checks out the target repository.
3. Runs `sync-standard.mjs`:
   - overwrites the files the standard manages (team rules, agents, team skills, PR template);
   - updates hooks only if the repository already uses them;
   - **adds** missing deny and ask rules to `.claude/settings.json`, never removes rules and never changes `allow`;
   - writes `.claude/STANDARD_VERSION`;
   - never changes `CLAUDE.md` or repository-specific files.
4. Commits to a new branch `chore/ai-standard-v<version>` and opens **one pull request** in that repository. It never pushes to the base branch.
5. The PR description lists updated files, added rules, and what the owner must review by hand (CLAUDE.md template changes, settings rules that exist only in the repository, files no longer shipped).

Afterwards:

- The repository's owner reviews and merges the PR like any other change. Required checks and CODEOWNERS apply.
- The job posts one announcement to the team chat with the version, the release notes link and the target repositories. Slack is the default (`SLACK_WEBHOOK_URL`); set `CHAT_PROVIDER=teams` to use Microsoft Teams (`TEAMS_WEBHOOK_URL`). Webhook URLs come only from GitHub Secrets.

Access:

The job needs write access to other repositories. **The final choice of credential is the security owner's decision.**

| Option | Setup | Why |
| --- | --- | --- |
| **Recommended: GitHub App** | Organisation-owned App installed only on the target repositories, with Contents and Pull requests write. Variable `STANDARD_APP_CLIENT_ID`, secret `STANDARD_APP_PRIVATE_KEY`. | The job creates a short-lived installation token for each target repository separately. Not tied to a person, so it survives people leaving. Every PR is shown as opened by the App. |
| Fallback: fine-grained personal access token | Token owned by a dedicated bot account, limited to the target repositories, Contents and Pull requests write, with an expiry date. Secret `STANDARD_UPDATE_TOKEN`. | Simple to set up, but long-lived, tied to an account, and must be rotated before it expires. |

The workflow uses the App when `STANDARD_APP_CLIENT_ID` is set, and the fallback token otherwise. Never use a classic personal access token or a token of a real person.

- Client repositories are added to the target list only with the project lead's agreement, and are usually `enabled: false` until the client's AI position is confirmed.

## 6. Adopting a version for the first time

New repositories do not use the update job for the first installation. Follow "How to adopt in a repository" in the README, then add the repository to `standard-targets.json` for future updates.

## 7. Skipping or delaying an update

- A repository owner may delay an update PR (for example during a release freeze), but not longer than the next minor release.
- Security releases are merged within 5 working days.
- If a repository cannot adopt a change, the owner records the exception with the owner of the standard (reason, end date).
