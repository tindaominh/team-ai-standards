# Team AI-assisted development standard

**Version:** 0.1.0 · **Status:** Draft for Wave 1 pilot · **Owner of the standard:** `<name>` · **Security owner:** `<name>`

[English](#english) · [Tiếng Việt](#tiếng-việt)

## English

### Purpose

This repository defines how our team uses AI tools in software development. We build and maintain multi-channel e-commerce integration middleware: marketplace adapters, stock sync and order conversion. We work in Node.js/TypeScript, TypeORM, MySQL and AWS. We handle client source code and customer data. The goal is faster delivery with the same or better quality, and without exposing confidential data.

### Scope

- Every developer on the team, every repository (internal and client) and every AI tool used for development work.
- Covered: which tools and data are allowed, the workflow and its evidence, roles, PR review, security, LLM features inside our products, context and cost, and the rollout plan.
- Not covered: general coding standards that our linters, CI and existing guidelines already define.

### Contents

| Path | What it is |
|---|---|
| `docs/en/`, `docs/vi/` | Human-facing documents, same structure in both languages |
| `docs/en/01-ai-usage-policy.md` | Approved tools, data classification, accountability |
| `docs/en/02-development-workflow.md` | Plan → test → implement → verify → review → PR → merge, Definition of Done, evidence |
| `docs/en/03-roles-and-responsibilities.md` | Who does and approves what |
| `docs/en/04-pr-review-checklist.md` | Checklist for reviewing AI-assisted PRs |
| `docs/en/05-security-guidelines.md` | Prompt injection, permissions, extensions, secrets, incidents |
| `docs/en/06-llm-in-product-pattern.md` | How product features may call an LLM safely |
| `docs/en/07-context-and-cost.md` | What goes where, session hygiene, model choice |
| `docs/en/08-adoption-plan.md` | Three-wave rollout, metrics, training, versioning |
| `docs/vi/ai-files-explained.md` | Vietnamese explanation of every AI-facing file |
| `templates/` | Files to copy into a repository (AI-facing, English) |
| `templates/hooks/` | Optional, opt-in deterministic hooks |
| `CHANGELOG.md` | Release history |

### How to adopt in a repository

1. **Classify the repository.** Client code → **strict** profile. Internal code with no client data → **standard** profile. If unsure → strict. Check that AI use is allowed for this repository (doc 01).
2. **Copy the templates** (see `docs/vi/ai-files-explained.md` for the full table):
   - `templates/CLAUDE.md` → `CLAUDE.md`, and fill every `<placeholder>`.
   - `templates/.claude/settings.json` (strict) or `templates/.claude/settings.standard.json` (standard) → `.claude/settings.json`.
   - `templates/.claude/rules`, `agents` and `skills` → `.claude/`.
   - `templates/.github/pull_request_template.md` → `.github/`.
3. **Align commands.** Make sure the npm scripts named in CLAUDE.md exist: `build`, `typecheck`, `lint`, `test`, `test:integration`, `migration:show`, `migration:generate`. If the repository uses other names, change CLAUDE.md, the settings allow-list and the `verification` skill together.
4. **Add** `config/env.example` with fake values. Confirm `.env*` is git-ignored.
5. **Optional:** enable hooks (see `templates/hooks/README.md`).
6. **Open a PR** with these files. It is reviewed like code. Record the standard version in CLAUDE.md.
7. Check the size: `wc -w CLAUDE.md .claude/rules/*/*.md` should stay under about 2,300 words.

### Versioning

- Semantic versioning: MAJOR = workflow or policy change requiring action, MINOR = new rules, skills or templates, PATCH = fixes and wording.
- Changes are proposed by PR to this repository and approved by the owner of the standard (and the security owner for security-related changes).
- English and Vietnamese documents are updated in the same PR.
- Repositories record the version they use in CLAUDE.md and upgrade when the owner announces a release.

## Tiếng Việt

### Mục đích

Repo này quy định cách team sử dụng công cụ AI trong phát triển phần mềm. Team xây dựng và vận hành middleware tích hợp thương mại điện tử đa kênh: adapter cho các marketplace, đồng bộ tồn kho, chuyển đổi đơn hàng. Stack là Node.js/TypeScript, TypeORM, MySQL và AWS. Team làm việc với source code của khách hàng và dữ liệu khách hàng. Mục tiêu là giao hàng nhanh hơn, chất lượng bằng hoặc tốt hơn, và không để lộ dữ liệu mật.

### Phạm vi

- Áp dụng cho mọi developer trong team, mọi repo (nội bộ lẫn của khách hàng) và mọi công cụ AI dùng trong công việc phát triển.
- Bao gồm: công cụ và dữ liệu được phép, quy trình làm việc và bằng chứng (evidence), vai trò, review PR, bảo mật, tính năng có gọi LLM trong sản phẩm, context và chi phí, kế hoạch triển khai.
- Không bao gồm: coding standard chung đã được linter, CI và các hướng dẫn hiện có quy định.

### Nội dung

| Đường dẫn | Là gì |
|---|---|
| `docs/en/`, `docs/vi/` | Tài liệu cho người đọc, hai ngôn ngữ cùng cấu trúc |
| `docs/vi/01-ai-usage-policy.md` | Công cụ được duyệt, phân loại dữ liệu, trách nhiệm |
| `docs/vi/02-development-workflow.md` | Plan → test → code → verify → review → PR → merge, Definition of Done, bằng chứng |
| `docs/vi/03-roles-and-responsibilities.md` | Ai làm gì, ai duyệt gì |
| `docs/vi/04-pr-review-checklist.md` | Checklist review PR có AI hỗ trợ |
| `docs/vi/05-security-guidelines.md` | Prompt injection, quyền, extension, secret, xử lý sự cố |
| `docs/vi/06-llm-in-product-pattern.md` | Cách tính năng sản phẩm gọi LLM một cách an toàn |
| `docs/vi/07-context-and-cost.md` | Nội dung nào đặt ở đâu, giữ session gọn, chọn model |
| `docs/vi/08-adoption-plan.md` | Triển khai 3 đợt, chỉ số, đào tạo, đánh version |
| `docs/vi/ai-files-explained.md` | Giải thích bằng tiếng Việt từng file dành cho AI |
| `templates/` | File để copy vào repo (dành cho AI, viết bằng tiếng Anh) |
| `templates/hooks/` | Hook tất định, không bắt buộc, phải chủ động bật |
| `CHANGELOG.md` | Lịch sử phát hành |

### Cách áp dụng cho một repo

1. **Phân loại repo.** Có code của khách hàng → profile **strict**. Code nội bộ, không có dữ liệu khách hàng → profile **standard**. Không chắc → strict. Kiểm tra repo này có được phép dùng AI không (tài liệu 01).
2. **Copy template** (bảng đầy đủ ở `docs/vi/ai-files-explained.md`):
   - `templates/CLAUDE.md` → `CLAUDE.md`, rồi điền hết các `<placeholder>`.
   - `templates/.claude/settings.json` (strict) hoặc `templates/.claude/settings.standard.json` (standard) → `.claude/settings.json`.
   - `templates/.claude/rules`, `agents`, `skills` → `.claude/`.
   - `templates/.github/pull_request_template.md` → `.github/`.
3. **Thống nhất lệnh.** Đảm bảo repo có các npm script ghi trong CLAUDE.md: `build`, `typecheck`, `lint`, `test`, `test:integration`, `migration:show`, `migration:generate`. Nếu repo đặt tên khác, sửa đồng thời CLAUDE.md, allow-list trong settings và skill `verification`.
4. **Thêm** `config/env.example` với giá trị giả. Kiểm tra `.env*` đã nằm trong `.gitignore`.
5. **Không bắt buộc:** bật hook (xem `templates/hooks/README.md`).
6. **Mở PR** chứa các file này. PR được review như code. Ghi version của bộ tiêu chuẩn vào CLAUDE.md.
7. Kiểm tra kích thước: `wc -w CLAUDE.md .claude/rules/*/*.md` nên dưới khoảng 2.300 từ.

### Đánh version

- Semantic versioning: MAJOR = thay đổi quy trình hoặc chính sách mà mọi người phải làm theo, MINOR = thêm rule, skill hoặc template, PATCH = sửa lỗi và câu chữ.
- Thay đổi được đề xuất bằng PR vào repo này và được owner of the standard duyệt (kèm security owner với thay đổi liên quan bảo mật).
- Tài liệu tiếng Anh và tiếng Việt được cập nhật trong cùng một PR.
- Mỗi repo ghi version đang dùng trong CLAUDE.md và nâng cấp khi owner công bố bản mới.
