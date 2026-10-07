# 01. AI usage policy

## Purpose

This policy says which AI tools we may use, what data may go into them, and who is accountable for the result. It applies to every developer, to every repository we work on (internal and client), and to any AI tool used for development work.

## Approved tools

Only tools in this table may be used on company or client work. A tool's status changes only after formal approval by the team lead and the security owner. Approval is recorded here with the approver's name and the date.

| Tool | Status | Approved by | Date | Allowed data | Notes |
|---|---|---|---|---|---|
| Claude Code | Under evaluation (Đang đánh giá) | | | Internal repositories during Wave 1 (see 08) | Status changes only after formal approval by the team lead / security owner. |
| `<tool>` | `<status>` | | | | |

Status values:

- **Under evaluation:** pilot use only, in the repositories named in the adoption plan.
- **Approved:** may be used within the "Allowed data" column.
- **Restricted:** approved for some repositories only (named in Notes).
- **Not allowed.**

Rules:

- Use only company-provided accounts or licences for approved tools. Personal accounts are not allowed for company or client work.
- Install AI extensions, plugins, skills, hooks or MCP servers only if they are on the approved list or reviewed under 05-security-guidelines.
- If a client contract restricts AI use, the client rule wins. See "Client-specific restrictions".

## Data classification

| Class | Examples | May be sent to an approved AI tool? |
|---|---|---|
| **Public** | Open-source code, public docs, public marketplace API docs | Yes |
| **Internal** | Our internal service code, internal docs, synthetic test data | Yes, with approved tools |
| **Client confidential** | Client source code, client architecture, client business rules | Only if the client allows it in writing and the repository is listed as allowed. Otherwise no. |
| **Personal data** | Customer names, phones, emails, addresses, order contents linked to a person | **Never** |
| **Secrets** | Passwords, API keys, tokens, private keys, AWS credentials, `.env` files, connection strings | **Never** |
| **Production data** | Database dumps, production logs, S3 exports, support tickets with customer data | **Never** |

Practical rules:

- Never paste secrets, personal data or production data into a prompt, a ticket you ask the AI to read, or a file the AI can read.
- Use synthetic data for tests, examples and debugging. If you need to reproduce a production bug, rebuild the case with fake values.
- Do not paste client names, client domain terms or code into web searches made through the AI.
- When you notice an AI tool has seen something it should not, follow the incident steps in 05-security-guidelines. Do not hide it.

## Client-specific restrictions

- Each client repository's `CLAUDE.md` states the client code and the settings profile in use (strict by default).
- The project lead records the client's position on AI in the project's internal page: allowed / allowed with conditions / not allowed, with the source (contract clause or written confirmation) and date.
- If the client's position is unknown, treat it as **not allowed** until confirmed.
- Some clients require specific tools, regions or no AI at all. These rules override this policy.

## Human accountability

- The developer who opens a PR owns every line in it, including AI-written lines. "The AI wrote it" is never an explanation for a defect.
- AI suggestions are proposals. A human decides what to commit, what to merge and what to deploy.
- AI must not approve PRs, merge, push, deploy or change cloud resources. Repository settings enforce this (see 05).
- Reviewers apply the same bar to AI-assisted code as to any other code (see 04-pr-review-checklist).

## Same quality bar

AI-assisted work must meet the same Definition of Done as any other work (see 02-development-workflow): tests, verification, review and documentation. Faster output is not a reason to skip any of them.

## Exceptions and questions

Ask the owner of the standard. Exceptions are written down with a reason, an owner and an end date.
