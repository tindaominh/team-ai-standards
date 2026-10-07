# Team AI-assisted development standard

**Version:** 0.2.0 · **Status:** Draft for Wave 1 pilot · **Owners:** see the Named people table in `docs/en/03-roles-and-responsibilities.md`

[English](#english) · [Tiếng Việt](#tiếng-việt)

## English

### Purpose

This repository defines how our team uses AI tools in software development. We build and maintain multi-channel e-commerce integration middleware: marketplace adapters, stock sync and order conversion. We work in Node.js/TypeScript with NestJS, TypeORM, MySQL and AWS. We handle client source code and customer data. The goal is faster delivery with the same or better quality, and without exposing confidential data.

### Scope

- Every developer on the team, every repository (internal and client) and every AI tool used for development work.
- Covered: which tools and data are allowed, the workflow and its evidence, roles, PR review, security, LLM features inside our products, context and cost, the rollout plan, documentation automation, and how this standard is versioned and distributed.
- Not covered: general coding standards that our linters, CI and existing guidelines already define.

### Contents

| Path | What it is |
| --- | --- |
| `docs/en/`, `docs/vi/` | Human-facing documents, same structure in both languages |
| `docs/en/01-ai-usage-policy.md` | Approved tools, data classification, accountability |
| `docs/en/02-development-workflow.md` | Plan → test → implement → verify → review → PR → merge, Definition of Done, evidence |
| `docs/en/03-roles-and-responsibilities.md` | Who does and approves what; the Named people table |
| `docs/en/04-pr-review-checklist.md` | Checklist for reviewing AI-assisted PRs |
| `docs/en/05-security-guidelines.md` | Prompt injection, permissions, extensions, hooks, secrets, incidents |
| `docs/en/06-llm-in-product-pattern.md` | How product features may call an LLM safely |
| `docs/en/07-context-and-cost.md` | What goes where, session hygiene, model choice |
| `docs/en/08-adoption-plan.md` | Three-wave rollout, metrics, training |
| `docs/en/09-docs-automation.md` | Keeping documentation current: reminders, CI checks, generated sections, notifications |
| `docs/en/10-versioning-and-distribution.md` | SemVer, CHANGELOG, releases, update PRs to project repositories |
| `docs/vi/ai-files-explained.md` | Vietnamese explanation of every AI-facing file |
| `templates/` | Files to copy into a project repository (AI-facing, English) |
| `templates/hooks/` | Optional, opt-in hooks that only check or remind |
| `templates/scripts/` | Docs generator and docs-update check used by the docs workflows |
| `templates/.github/` | PR template, CODEOWNERS example, docs workflows |
| `templates/tools/docs-ai/` | Pinned CLI manifest for the optional AI docs job (not used in the pilot) |
| `scripts/` | Checks and tools for this repository (parity, budget, JSON, settings generator, sync for update PRs, smoke test) |
| `.github/workflows/` | CI for this repository and the release update job |
| `audit-exceptions.json` | Accepted npm audit advisories for this repository's dev tools, with reasons and review dates |
| `CHANGELOG.md` | Release history |

### How to adopt in a repository

1. **Classify the repository.** Client code → **strict** profile. Internal code with no client data → **standard** profile. If unsure → strict. Check that AI use is allowed for this repository (doc 01).
2. **Copy the templates** (see `docs/vi/ai-files-explained.md` for the full table):
   - `templates/CLAUDE.md` → `CLAUDE.md`, and fill every `<placeholder>`.
   - `templates/.claude/settings.json` (strict) or `templates/.claude/settings.standard.json` (standard) → `.claude/settings.json`.
   - `templates/.claude/rules`, `agents`, `skills` and `STANDARD_VERSION` → `.claude/`.
   - `templates/.github/pull_request_template.md` and `CODEOWNERS` → `.github/`.
3. **Fill in the command table.** In CLAUDE.md, write this repository's command for each placeholder (`<build-cmd>`, `<typecheck-cmd>`, `<unit-test-cmd>`, `<integration-test-cmd>`, `<migration-show-cmd>`, …). Replace the same placeholders in `.claude/settings.json`. Skills read the table; nothing else needs to change.
4. **Add** `config/env.example` with fake values. Confirm `.env*` is git-ignored.
5. **Optional:** enable hooks (`templates/hooks/README.md`) and the docs workflows (doc 09).
6. **Open a PR** with these files. It is reviewed like code.
7. **Register** the repository in `.github/standard-targets.json` of this repository, so it receives update PRs (doc 10).
8. Check the size: `wc -w CLAUDE.md .claude/rules/*/*.md` should stay under about 2,000 words after filling in.

### Versioning

- Semantic versioning, CHANGELOG rules, release tags and update PRs are described in `docs/en/10-versioning-and-distribution.md`.
- Each project repository records the version it uses in `.claude/STANDARD_VERSION`.
- Changes to this repository go through a PR; `npm run check` must pass locally: Markdown lint, JSON, settings, bilingual parity, context budget, smoke tests. CI also runs actionlint on all workflows and checks `npm audit` against `audit-exceptions.json`.

## Tiếng Việt

### Mục đích

Repo này quy định cách team sử dụng công cụ AI trong phát triển phần mềm. Team xây dựng và vận hành middleware tích hợp thương mại điện tử đa kênh: adapter cho các marketplace, đồng bộ tồn kho, chuyển đổi đơn hàng. Stack là Node.js/TypeScript với NestJS, TypeORM, MySQL và AWS. Team làm việc với source code của khách hàng và dữ liệu khách hàng. Mục tiêu là giao hàng nhanh hơn, chất lượng bằng hoặc tốt hơn, và không để lộ dữ liệu mật.

### Phạm vi

- Áp dụng cho mọi developer trong team, mọi repo (nội bộ lẫn của khách hàng) và mọi công cụ AI dùng trong công việc phát triển.
- Bao gồm: công cụ và dữ liệu được phép, quy trình làm việc và bằng chứng (evidence), vai trò, review PR, bảo mật, tính năng có gọi LLM trong sản phẩm, context và chi phí, kế hoạch triển khai, tự động hoá tài liệu, và cách đánh version và phân phối bộ tiêu chuẩn.
- Không bao gồm: coding standard chung đã được linter, CI và các hướng dẫn hiện có quy định.

### Nội dung

| Đường dẫn | Là gì |
| --- | --- |
| `docs/en/`, `docs/vi/` | Tài liệu cho người đọc, hai ngôn ngữ cùng cấu trúc |
| `docs/vi/01-ai-usage-policy.md` | Công cụ được duyệt, phân loại dữ liệu, trách nhiệm |
| `docs/vi/02-development-workflow.md` | Plan → test → code → verify → review → PR → merge, Definition of Done, bằng chứng |
| `docs/vi/03-roles-and-responsibilities.md` | Ai làm gì, ai duyệt gì; bảng Named people |
| `docs/vi/04-pr-review-checklist.md` | Checklist review PR có AI hỗ trợ |
| `docs/vi/05-security-guidelines.md` | Prompt injection, quyền, extension, hook, secret, xử lý sự cố |
| `docs/vi/06-llm-in-product-pattern.md` | Cách tính năng sản phẩm gọi LLM một cách an toàn |
| `docs/vi/07-context-and-cost.md` | Nội dung nào đặt ở đâu, giữ session gọn, chọn model |
| `docs/vi/08-adoption-plan.md` | Triển khai 3 đợt, chỉ số, đào tạo |
| `docs/vi/09-docs-automation.md` | Giữ tài liệu luôn cập nhật: nhắc nhở, kiểm tra trong CI, phần tự sinh, thông báo |
| `docs/vi/10-versioning-and-distribution.md` | SemVer, CHANGELOG, phát hành, PR cập nhật tới các repo dự án |
| `docs/vi/ai-files-explained.md` | Giải thích bằng tiếng Việt từng file dành cho AI |
| `templates/` | File để copy vào repo dự án (dành cho AI, viết bằng tiếng Anh) |
| `templates/hooks/` | Hook không bắt buộc, chỉ kiểm tra hoặc nhắc nhở |
| `templates/scripts/` | Script sinh tài liệu và kiểm tra cập nhật tài liệu, dùng cho các workflow docs |
| `templates/.github/` | PR template, ví dụ CODEOWNERS, các workflow docs |
| `templates/tools/docs-ai/` | Manifest ghim version CLI cho job AI docs tuỳ chọn (không dùng trong pilot) |
| `scripts/` | Công cụ kiểm tra cho repo này (parity, budget, JSON, sinh settings, đồng bộ cho PR cập nhật, smoke test) |
| `.github/workflows/` | CI của repo này và job cập nhật khi phát hành |
| `audit-exceptions.json` | Các cảnh báo npm audit đã chấp nhận cho công cụ dev của repo này, kèm lý do và ngày review lại |
| `CHANGELOG.md` | Lịch sử phát hành |

### Cách áp dụng cho một repo

1. **Phân loại repo.** Có code của khách hàng → profile **strict**. Code nội bộ, không có dữ liệu khách hàng → profile **standard**. Không chắc → strict. Kiểm tra repo này có được phép dùng AI không (tài liệu 01).
2. **Copy template** (bảng đầy đủ ở `docs/vi/ai-files-explained.md`):
   - `templates/CLAUDE.md` → `CLAUDE.md`, rồi điền hết các `<placeholder>`.
   - `templates/.claude/settings.json` (strict) hoặc `templates/.claude/settings.standard.json` (standard) → `.claude/settings.json`.
   - `templates/.claude/rules`, `agents`, `skills` và `STANDARD_VERSION` → `.claude/`.
   - `templates/.github/pull_request_template.md` và `CODEOWNERS` → `.github/`.
3. **Điền bảng lệnh.** Trong CLAUDE.md, ghi lệnh thật của repo cho từng placeholder (`<build-cmd>`, `<typecheck-cmd>`, `<unit-test-cmd>`, `<integration-test-cmd>`, `<migration-show-cmd>`, …). Thay các placeholder tương ứng trong `.claude/settings.json`. Các skill đọc bảng này nên không cần sửa gì khác.
4. **Thêm** `config/env.example` với giá trị giả. Kiểm tra `.env*` đã nằm trong `.gitignore`.
5. **Không bắt buộc:** bật hook (`templates/hooks/README.md`) và các workflow docs (tài liệu 09).
6. **Mở PR** chứa các file này. PR được review như code.
7. **Đăng ký** repo trong `.github/standard-targets.json` của repo này để nhận PR cập nhật (tài liệu 10).
8. Kiểm tra kích thước: `wc -w CLAUDE.md .claude/rules/*/*.md` nên dưới khoảng 2.000 từ sau khi điền.

### Đánh version

- Semantic versioning, quy tắc CHANGELOG, tag phát hành và PR cập nhật được mô tả trong `docs/vi/10-versioning-and-distribution.md`.
- Mỗi repo dự án ghi version đang dùng trong `.claude/STANDARD_VERSION`.
- Mọi thay đổi trong repo này đi qua PR; `npm run check` phải pass ở máy local: Markdown lint, JSON, settings, parity hai ngôn ngữ, context budget, smoke test. CI chạy thêm actionlint cho mọi workflow và đối chiếu `npm audit` với `audit-exceptions.json`.
