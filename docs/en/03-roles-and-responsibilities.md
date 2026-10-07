# 03. Roles and responsibilities

## Purpose

This document defines who owns what when AI tools are part of the work, and who approves each decision.

## Roles

| Role | Who | Owns |
| --- | --- | --- |
| **Developer (author)** | The person assigned to the ticket | The change from plan to merge, including every AI-written line |
| **Reviewer** | Another developer (or the lead) | Independent judgement on correctness, safety and fit |
| **AI assistant** | Claude Code (and approved subagents) | Proposals: plans, tests, code, review findings. Nothing it produces is final without a human |
| **Tech lead** | Named person (see Named people) | Architecture decisions, exceptions, merge rights for protected branches |
| **Security owner** | Named person (see Named people) | Approval of AI tools, data classification questions, incident handling |
| **Owner of the standard** | Named person (see Named people) | This standard, its versions, templates and the adoption plan |
| **Wave champion** | One per adoption wave (see Named people) | Helping colleagues, collecting feedback and metrics during a wave |
| **Project lead (client projects)** | Per client, recorded in the project page | Recording the client's AI position and repository restrictions |

## Named people

This is the only place where names are recorded. Other documents refer to this table. Update it by PR when someone changes role.

| Role | Name | Backup | Since |
| --- | --- | --- | --- |
| Owner of the standard | `<name>` | `<name>` | `<YYYY-MM-DD>` |
| Security owner | `<name>` | `<name>` | `<YYYY-MM-DD>` |
| Tech lead | `<name>` | `<name>` | `<YYYY-MM-DD>` |
| Wave 1 champion | `<name>` | | `<YYYY-MM-DD>` |
| Wave 2 champion | `<name>` | | `<YYYY-MM-DD>` |
| Wave 3 champion | `<name>` | | `<YYYY-MM-DD>` |

## Responsibility matrix

R = does the work, A = accountable / approves, C = consulted, I = informed.

| Activity | Developer | AI | Reviewer | Tech lead | Security owner |
| --- | --- | --- | --- | --- | --- |
| Clarify ticket and acceptance criteria | R/A | C | | C | |
| Write plan | R/A | R | | C (large changes) | C (sensitive data) |
| Approve plan | A | | | A (architecture changes) | |
| Write tests and code | R/A | R | | | |
| Run verification | A | R | | | |
| Fresh-context AI review | A | R | I | | |
| Decide on AI findings (fix or answer) | R/A | C | I | | |
| Commit and push | R/A | (strict: none; standard: proposes) | | | |
| Open PR with evidence | R/A | C | I | | |
| Human review and approval | | | R/A | C | C (security-sensitive) |
| Merge | R | | | A (protected branches) | |
| Deploy | Per release process, never the AI | | | A | |
| Approve a new AI tool, plugin, MCP server or hook | | | | A | A |
| Report an AI data incident | R | | | I | A |
| Change this standard | C | | C | C | C |

The owner of the standard is accountable for the last row.

## What the AI may and may not do

May:

- Read the repository (except secret and dump files), search code and run allowed read-only, build, lint and test commands.
- Propose plans, tests, code changes, commit messages and PR descriptions.
- Edit files in the working copy when the developer asks.
- Run subagents for planning and review.

May not:

- Read secrets, `.env*` files, credentials or production data.
- Push, merge, rebase shared branches, force-push or reset hard.
- Commit in client repositories (strict profile). In internal repositories, commit only with the developer's confirmation.
- Deploy, or create, change or delete cloud resources.
- Install packages, plugins, MCP servers or hooks without the developer's approval.
- Approve its own work or anyone's PR.

## Reviewer duties for AI-assisted PRs

- Review the code, not the evidence alone. Evidence shows what was run; it does not prove the logic is right.
- Check that the tests are meaningful: would they fail if the behaviour broke?
- Check that AI review findings were handled honestly.
- Use 04-pr-review-checklist.

## Escalation

- Disagreement on a finding: author and reviewer discuss; the tech lead decides if needed.
- Possible data exposure: stop, inform the security owner the same day (see 05).
- Process problems with the standard: raise them with the wave champion or the owner of the standard.
