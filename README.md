# Team AI-assisted development standard

**Version:** 0.3.0 · **Status:** Draft for Wave 1 pilot · **Owners:** see the Named people table in `docs/en/03-roles-and-responsibilities.md`

[English](#english) · [Tiếng Việt](#tiếng-việt)

## English

**Start here: [Quickstart](docs/en/00-quickstart.md)** — adopt the standard in a repository with one command and about 30 minutes of project details.

### Purpose

This repository defines how our team uses AI tools in software development. We build and maintain multi-channel e-commerce integration middleware: marketplace adapters, stock sync and order conversion. We work in Node.js/TypeScript (mostly NestJS), TypeORM, MySQL or PostgreSQL, and AWS. We handle client source code and customer data. The goal is faster delivery with the same or better quality, and without exposing confidential data.

### Scope

- Every developer on the team, every repository (internal and client) and every AI tool used for development work.
- Covered: which tools and data are allowed, the workflow and its evidence, roles, PR review, security, LLM features inside our products, context and cost, the rollout plan, documentation automation, and how this standard is versioned, adopted and updated.
- Not covered: general coding standards that our linters, CI and existing guidelines already define.

### Adopt in a repository

```bash
cd <your-repository>
node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
```

The script detects the stack from `package.json` (framework, databases, data access, AWS) and shows it; correct it with `--framework`, `--db`, `--data-access`, `--with` (or a shortcut such as `--stack nestjs-mysql`). Profiles: `strict` (client repositories, default) or `standard` (internal only). `--dry-run` writes nothing and prints every change, with diffs and a plan hash; `--yes` applies exactly that plan, on a clean branch. Existing files are merged, not overwritten: `CLAUDE.md` gets `std:` blocks, the PR template and `CODEOWNERS` get a block at the end, and stricter rules from an existing `settings.json` move into `.claude/project.json`. Anything that needs a person (for example `--repo-owner`) is listed under "Decisions required" (details in the quickstart).

### Three layers in a project repository

| Layer | What | Who changes it |
| --- | --- | --- |
| 1. Standard | `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, generated `.claude/settings.json`, PR template, CODEOWNERS block, `std-check` workflow | Only update PRs from this repository |
| 2. Project | `CLAUDE.md`, `.claude/project.json` (stack, profile, commands, extra permissions), `.claude/rules/local/` | The repository's team, by PR |
| 3. Personal | `.claude/settings.local.json` | Each developer; never committed |

Details: `docs/en/10-versioning-and-distribution.md`.

### Contents

| Path | What it is |
| --- | --- |
| `docs/en/00-quickstart.md` | One page for developers: adopt, daily workflow, where to change things |
| `docs/en/01-ai-usage-policy.md` | Approved tools, data classification, accountability |
| `docs/en/02-development-workflow.md` | Plan → test → implement → verify → review → PR → merge, Definition of Done, evidence |
| `docs/en/03-roles-and-responsibilities.md` | Who does and approves what; the Named people table |
| `docs/en/04-pr-review-checklist.md` | Checklist for reviewing AI-assisted PRs |
| `docs/en/05-security-guidelines.md` | Prompt injection, permissions, extensions, hooks, secrets, incidents |
| `docs/en/06-llm-in-product-pattern.md` | How product features may call an LLM safely |
| `docs/en/07-context-and-cost.md` | What goes where, session hygiene, model choice |
| `docs/en/08-adoption-plan.md` | Three-wave rollout, metrics, training |
| `docs/en/09-docs-automation.md` | Keeping documentation current |
| `docs/en/10-versioning-and-distribution.md` | Versions, the three layers, adoption flags, update PRs |
| `docs/en/11-adding-a-stack-fragment.md` | How to add a framework, database or data-access fragment |
| `docs/vi/` | The same documents in Vietnamese, plus `ai-files-explained.md` |
| `templates/` | Layer 1 files exactly as a project repository receives them, the `CLAUDE.md` skeleton, and `fragments/` (composable stack fragments and their registry) |
| `scripts/adopt.mjs` | Adoption script, run from a project repository |
| `scripts/sync-standard.mjs` | Writes Layer 1 files for an update PR |
| `scripts/` (other) | Checks for this repository: parity, budget per stack, JSON, settings generator, audit exceptions, smoke tests |
| `.github/workflows/` | CI for this repository and the release update job |
| `audit-exceptions.json` | Accepted npm audit advisories for this repository's dev tools |
| `CHANGELOG.md` | Release history |

### Versioning

- Semantic versioning, CHANGELOG rules, release tags and update PRs: `docs/en/10-versioning-and-distribution.md`.
- Each project repository records its version in `.claude/STANDARD_VERSION`.
- Changes to this repository go through a PR; `npm run check` must pass locally: Markdown lint, JSON, settings, bilingual parity, context budget for every valid fragment combination, smoke tests. CI also runs actionlint on all workflows and checks `npm audit` against `audit-exceptions.json`.

## Tiếng Việt

**Bắt đầu tại đây: [Bắt đầu nhanh](docs/vi/00-quickstart.md)** — áp dụng bộ tiêu chuẩn vào một repo bằng một lệnh và khoảng 30 phút điền thông tin dự án.

### Mục đích

Repo này quy định cách team sử dụng công cụ AI trong phát triển phần mềm. Team xây dựng và vận hành middleware tích hợp thương mại điện tử đa kênh: adapter cho các marketplace, đồng bộ tồn kho, chuyển đổi đơn hàng. Stack là Node.js/TypeScript (chủ yếu NestJS), TypeORM, MySQL hoặc PostgreSQL, và AWS. Team làm việc với source code của khách hàng và dữ liệu khách hàng. Mục tiêu là giao hàng nhanh hơn, chất lượng bằng hoặc tốt hơn, và không để lộ dữ liệu mật.

### Phạm vi

- Áp dụng cho mọi developer trong team, mọi repo (nội bộ lẫn của khách hàng) và mọi công cụ AI dùng trong công việc phát triển.
- Bao gồm: công cụ và dữ liệu được phép, quy trình làm việc và bằng chứng (evidence), vai trò, review PR, bảo mật, tính năng có gọi LLM trong sản phẩm, context và chi phí, kế hoạch triển khai, tự động hoá tài liệu, và cách đánh version, áp dụng và cập nhật bộ tiêu chuẩn.
- Không bao gồm: coding standard chung đã được linter, CI và các hướng dẫn hiện có quy định.

### Áp dụng cho một repo

```bash
cd <your-repository>
node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
```

Script tự nhận diện stack từ `package.json` (framework, database, data access, AWS) và in ra; sửa lại bằng `--framework`, `--db`, `--data-access`, `--with` (hoặc lối tắt như `--stack nestjs-mysql`). Profile: `strict` (repo khách hàng, mặc định) hoặc `standard` (chỉ repo nội bộ). `--dry-run` không ghi gì và in ra mọi thay đổi, kèm diff và plan hash; `--yes` áp dụng đúng plan đó, trên một branch sạch. File đã có được gộp chứ không bị ghi đè: `CLAUDE.md` có thêm các khối `std:`, PR template và `CODEOWNERS` có thêm một khối ở cuối, các rule chặt hơn trong `settings.json` đang có được chuyển vào `.claude/project.json`. Những gì cần con người quyết định (ví dụ `--repo-owner`) được liệt kê trong "Decisions required" (chi tiết trong quickstart).

### Ba lớp trong một repo dự án

| Lớp | Gồm những gì | Ai được thay đổi |
| --- | --- | --- |
| 1. Tiêu chuẩn | `.claude/rules/std/`, agent và skill `std-*`, `.claude/std/`, `.claude/settings.json` (được sinh ra), PR template, khối trong CODEOWNERS, workflow `std-check` | Chỉ qua PR cập nhật từ repo này |
| 2. Dự án | `CLAUDE.md`, `.claude/project.json` (stack, profile, lệnh, quyền bổ sung), `.claude/rules/local/` | Team của repo, qua PR |
| 3. Cá nhân | `.claude/settings.local.json` | Từng developer; không bao giờ commit |

Chi tiết: `docs/vi/10-versioning-and-distribution.md`.

### Nội dung

| Đường dẫn | Là gì |
| --- | --- |
| `docs/vi/00-quickstart.md` | Một trang cho developer: áp dụng, quy trình hằng ngày, sửa ở đâu |
| `docs/vi/01-ai-usage-policy.md` | Công cụ được duyệt, phân loại dữ liệu, trách nhiệm |
| `docs/vi/02-development-workflow.md` | Plan → test → code → verify → review → PR → merge, Definition of Done, bằng chứng |
| `docs/vi/03-roles-and-responsibilities.md` | Ai làm gì, ai duyệt gì; bảng Named people |
| `docs/vi/04-pr-review-checklist.md` | Checklist review PR có AI hỗ trợ |
| `docs/vi/05-security-guidelines.md` | Prompt injection, quyền, extension, hook, secret, xử lý sự cố |
| `docs/vi/06-llm-in-product-pattern.md` | Cách tính năng sản phẩm gọi LLM một cách an toàn |
| `docs/vi/07-context-and-cost.md` | Nội dung nào đặt ở đâu, giữ session gọn, chọn model |
| `docs/vi/08-adoption-plan.md` | Triển khai 3 đợt, chỉ số, đào tạo |
| `docs/vi/09-docs-automation.md` | Giữ tài liệu luôn cập nhật |
| `docs/vi/10-versioning-and-distribution.md` | Version, ba lớp, flag khi áp dụng, PR cập nhật |
| `docs/vi/11-adding-a-stack-fragment.md` | Cách thêm fragment cho framework, database hoặc data access |
| `docs/vi/ai-files-explained.md` | Giải thích bằng tiếng Việt từng file dành cho AI |
| `templates/` | File lớp 1 đúng như repo dự án nhận được, khung `CLAUDE.md`, và `fragments/` (các stack fragment ghép được và registry của chúng) |
| `scripts/adopt.mjs` | Script áp dụng, chạy từ repo dự án |
| `scripts/sync-standard.mjs` | Ghi các file lớp 1 cho PR cập nhật |
| `scripts/` (còn lại) | Công cụ kiểm tra cho repo này: parity, budget theo từng stack, JSON, sinh settings, ngoại lệ audit, smoke test |
| `.github/workflows/` | CI của repo này và job cập nhật khi phát hành |
| `audit-exceptions.json` | Các cảnh báo npm audit đã chấp nhận cho công cụ dev của repo này |
| `CHANGELOG.md` | Lịch sử phát hành |

### Đánh version

- Semantic versioning, quy tắc CHANGELOG, tag phát hành và PR cập nhật: `docs/vi/10-versioning-and-distribution.md`.
- Mỗi repo dự án ghi version đang dùng trong `.claude/STANDARD_VERSION`.
- Mọi thay đổi trong repo này đi qua PR; `npm run check` phải pass ở máy local: Markdown lint, JSON, settings, parity hai ngôn ngữ, context budget cho mọi tổ hợp fragment hợp lệ, smoke test. CI chạy thêm actionlint cho mọi workflow và đối chiếu `npm audit` với `audit-exceptions.json`.
