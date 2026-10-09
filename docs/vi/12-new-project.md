# 12. Bắt đầu một dự án mới

## Mục đích

Cách bắt đầu một repo mới theo standard: tạo ứng dụng, áp dụng standard, điền context của dự án, rồi làm việc theo từng ticket. Với repo đã có sẵn, xem mục [Chạy adopt](../../README.md#chạy-adopt) trong README.

## 1. Standard cung cấp gì, bạn cung cấp gì

Standard cung cấp tự động:

- rule, quy trình và các skill, permission (`.claude/rules/std/`, skill và agent `std-*`, `.claude/settings.json`);
- detect stack và danh sách command trong `CLAUDE.md`, từ `package.json` và `.claude/project.json`;
- khi đã có code, cấu trúc mà Claude tự đọc được từ code (module, entity, test).

Phải đến từ con người:

- mục đích, người dùng, phạm vi và những gì nằm ngoài phạm vi;
- thuật ngữ nghiệp vụ;
- hệ thống bên ngoài (API, marketplace, queue) và giới hạn của chúng;
- phân loại dữ liệu;
- các quyết định kiến trúc và lý do;
- yêu cầu và tiêu chí chấp nhận của từng ticket.

Dự án mới chưa có code để đọc, nên gần như toàn bộ context đến từ con người. Prompt 01 và 02 biến việc này thành một buổi phỏng vấn: Claude hỏi, bạn trả lời và duyệt, thay vì tự viết từ đầu. Bạn có thể đưa cho Claude các tài liệu sẵn có (yêu cầu của khách hàng, tài liệu API, biên bản họp), theo [01, chính sách sử dụng AI](01-ai-usage-policy.md): không bao giờ đưa secret, credential, dữ liệu khách hàng thật hay dữ liệu cá nhân.

Context có ba lớp:

| Lớp | Ở đâu | Khi nào được nạp |
| --- | --- | --- |
| Ổn định | `CLAUDE.md`, ngắn gọn | Luôn luôn, trong mọi phiên |
| Chi tiết | `docs/PROJECT_SPEC.md` và ghi chú thiết kế | Khi cần, khi được import hoặc được đọc |
| Theo task | Prompt của ticket (prompt 04) | Chỉ trong phiên đó |

Giữ mọi lớp luôn cập nhật. Context lỗi thời còn tệ hơn không có, vì AI làm theo nó một cách tự tin. Khi một quyết định thay đổi, cập nhật `CLAUDE.md` hoặc đặc tả trong cùng pull request.

## 2. Chọn cách bắt đầu

| Cách | Khi nào | Stack |
| --- | --- | --- |
| **a. Scaffold trước (khuyến nghị)** | Framework có CLI chính thức (NestJS) và đã biết database | Detect từ `package.json` |
| **b. Repo rỗng** | Muốn Claude Code tạo skeleton theo các rule của standard, hoặc repo phải có trước khi chốt stack | Chỉ định bằng flag; command được điền khi chạy lại adopt |

Cả hai cách đều để checkout của standard cạnh dự án (`../team-ai-standards`) và ở một tag release: `git -C ../team-ai-standards describe --tags` in ra `vX.Y.Z` và `git -C ../team-ai-standards status` sạch. Nếu không, `--yes` sẽ từ chối (mục 5).

## 3. Cách a: scaffold trước

```bash
pnpm dlx @nestjs/cli new orders-service --package-manager pnpm --skip-git
cd orders-service
pnpm add @nestjs/typeorm typeorm mysql2 @nestjs/config zod
git init -b main
git add -A
git commit -m "chore: scaffold NestJS application"
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @<org>/<team> --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @<org>/<team> --yes
```

- Dry run hiển thị stack được detect (`nestjs + mysql + typeorm`, nguồn `detected`) và các command tìm thấy trong script của Nest (`pnpm build`, `pnpm lint`, `pnpm test`). Với PostgreSQL, dùng `--db postgres` và `pg` thay cho `mysql2`. Giải quyết mọi mục trong "Decisions required" và chạy lại `--dry-run` trước khi chạy `--yes`.
- Commit kết quả và mở pull request. Sau đó làm tiếp mục 6.

## 4. Cách b: repo rỗng

```bash
mkdir orders-service && cd orders-service
git init -b main
git commit --allow-empty -m "chore: initial commit"
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --framework nestjs --db mysql --data-access typeorm --without-optional --repo-owner @<org>/<team> --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --framework nestjs --db mysql --data-access typeorm --without-optional --repo-owner @<org>/<team> --yes
git add -A
git commit -m "chore: adopt team AI standard"
```

- Chưa có `package.json` nên mọi command đều là `not set`. Mở Claude Code trong repo và gửi prompt 05 (mục 8.5): Claude scaffold bằng CLI chính thức theo các rule của standard, rồi dừng.
- Commit skeleton, rồi chạy lại adopt không cần flag (các giá trị đã lưu được dùng lại). Command nào còn `null` trong `.claude/project.json` sẽ được điền từ `package.json`; command đã đặt thì không bao giờ bị thay:

```bash
git add -A
git commit -m "chore: scaffold NestJS application"
node ../team-ai-standards/scripts/adopt.mjs --dry-run
node ../team-ai-standards/scripts/adopt.mjs --yes
```

## 5. adopt kiểm tra những gì

- **Checkout của standard:** `--yes` từ chối khi checkout đang chạy có file bị sửa hoặc chưa track, hoặc HEAD không nằm ở tag `v<version>` theo `package.json` của nó. `--dry-run` báo cùng vấn đề dưới dạng cảnh báo, kèm các lệnh git để sửa. `--allow-unreleased` dành cho maintainer thử thay đổi chưa release, và được in ra trong output.
- **Repo dự án:** `--yes` từ chối thư mục không phải git repo, working tree chưa sạch, hoặc default branch, mỗi khi nó sẽ ghi bất cứ thứ gì, kể cả khi chỉ tạo file mới. Vì vậy cách a và cách b đều commit và chuyển sang một branch trước khi chạy adopt; thay đổi được review trong pull request. Nếu một lần ghi bị lỗi, mọi thay đổi được hoàn tác và plan đã xem được giữ lại (tài liệu 10, mục 6).

## 6. Sau khi adopt

- **CLAUDE.md:** điền các mục `TODO(adopt)` bằng prompt 01. adopt in bước này đầu tiên trong "Next steps" khi `CLAUDE.md` chưa có nội dung dự án. Giữ file ngắn; chi tiết để trong `docs/`.
- **Đặc tả (tuỳ chọn):** prompt 02 viết `docs/PROJECT_SPEC.md` và import nó từ `CLAUDE.md` bằng dòng `@docs/PROJECT_SPEC.md`.
- **Rule của dự án:** mỗi chủ đề một file trong `.claude/rules/local/`.
- **Command:** sửa `.claude/project.json` → `commands`, rồi chạy `node .claude/std/compose-settings.mjs`; lệnh này tạo lại `.claude/settings.json` và khối `commands` trong `CLAUDE.md`.
- **Plan đầu tiên:** prompt 03, trong plan mode, trước khi viết code ứng dụng.

## 7. Vòng làm việc hằng ngày

Với mỗi ticket, prompt 04 chạy cả vòng:

1. `std-plan`: một plan, được duyệt trước khi viết code.
2. `std-tdd-workflow`: test fail kèm bằng chứng RED, rồi mới viết code.
3. `std-verification`: chạy đến khi báo READY.
4. `std-code-review` trong context mới (thêm `std-security-review` hoặc `std-db-migration-review` khi cần).
5. Nội dung pull request theo PR template, kèm bằng chứng.
6. Một người review và merge.

## 8. Prompt

Các prompt nằm trong checkout của standard, `templates/prompts/`. Chúng không được copy vào repo dự án. Dán prompt vào Claude Code và thay từng `<placeholder>`. Prompt viết bằng tiếng Anh và dùng nguyên văn; đoạn bên dưới được sinh từ các file đó.

### 8.1 Điền CLAUDE.md (01)

Claude hỏi từng câu một (tối đa 10 câu): mục đích, người dùng, luồng chính, kiến trúc, hệ thống bên ngoài, phân loại dữ liệu, môi trường, cách chạy local, những gì nằm ngoài phạm vi. Sau đó Claude đề xuất nội dung các mục `TODO(adopt)` và chờ bạn duyệt. Claude không sửa khối `std:` hay file của standard.

<!-- AUTO-GENERATED:prompt-01 START -->

```text
When to use: right after adoption, when `CLAUDE.md` still has `TODO(adopt)` items. Replace each `<placeholder>` before sending.

We are filling in `CLAUDE.md` for the repository <repository-name>. Interview me first, then propose the text.

1. Read `CLAUDE.md`, `.claude/project.json` and the folder layout. Do not read `.env` or any secret.
2. Ask me one question at a time, at most 10 in total, and wait for each answer. Cover: purpose, users, main flows, architecture, external systems (APIs, marketplaces, queues), data classification (internal, client code, personal data), environments, local setup, non-goals. Skip a question when the repository already answers it.
3. Then propose the filled `TODO(adopt)` sections as one diff of `CLAUDE.md` and wait for my approval before writing.

Rules:

- Change only text outside the `<!-- std:begin ... -->` / `<!-- std:end ... -->` blocks. Never edit standard files: `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, `.claude/settings.json`.
- Keep `CLAUDE.md` short: facts Claude needs in every session. Put detail in `docs/` and link to it. Longer project rules go in `.claude/rules/local/`.
- Where I do not know an answer, leave `TODO(adopt): <what is missing>` instead of guessing.
```

<!-- AUTO-GENERATED:prompt-01 END -->

### 8.2 Đặc tả dự án (02)

Chuyển buổi phỏng vấn và ghi chú của bạn thành `docs/PROJECT_SPEC.md` (mục tiêu, ngoài phạm vi, ràng buộc, kiến trúc, dữ liệu, các giai đoạn, câu hỏi mở) và thêm dòng import vào `CLAUDE.md`.

<!-- AUTO-GENERATED:prompt-02 START -->

```text
When to use: after prompt 01, when the project needs a written specification that Claude reads at the start of each session.

Write `docs/PROJECT_SPEC.md` for <repository-name> from our interview and these notes: <paste notes, links to tickets or documents>.

Sections: Goals, Non-goals, Constraints (client, security, data, performance, deadlines), Architecture, Data (entities, classification, retention), Phases (milestones with a short outcome each), Open questions.

Rules:

- Use only what I said or wrote; mark anything assumed as "Assumption:" and list it under Open questions.
- Keep it to what a developer needs to make decisions; no marketing text.
- Add one line `@docs/PROJECT_SPEC.md` to the Project section of `CLAUDE.md` (outside the `std:` blocks) so the spec is imported.
- Show me the file and the `CLAUDE.md` change, and wait for my approval before writing.
```

<!-- AUTO-GENERATED:prompt-02 END -->

### 8.3 Plan khởi động (03)

Phiên plan mode: dùng `std-plan` chia milestone đầu tiên thành các phase (Phase 0 là setup, skeleton, CI, môi trường local), lưu vào `docs/plans/`, và chờ duyệt trước khi viết code.

<!-- AUTO-GENERATED:prompt-03 START -->

```text
When to use: before the first line of application code, to plan the first milestone in plan mode.

Plan the first milestone of <repository-name>: <milestone, for example "orders can be imported from <marketplace>">.

1. Read `CLAUDE.md` and `docs/PROJECT_SPEC.md` (if it exists).
2. Use the `std-plan` skill. Split the milestone into phases, each small enough for one pull request:
   - Phase 0: setup — project skeleton, configuration validated at startup, lint, typecheck and test commands, CI, local environment (database in Docker, `config/env.example`).
   - Later phases: one slice of behaviour each, with its tests and acceptance criteria.
3. For each phase: goal, files or modules touched, tests to write first, risks, and what a reviewer checks.
4. Save the plan as `docs/plans/<yyyy-mm-dd>-<milestone-slug>.md`.
5. Stop and wait for my approval. Do not write application code in this session.
```

<!-- AUTO-GENERATED:prompt-03 END -->

### 8.4 Ticket tính năng (04)

Mỗi ticket một prompt: mã Backlog, mục tiêu, tiêu chí chấp nhận, rồi cả vòng ở mục 7. Claude không chạy lệnh git có ghi.

<!-- AUTO-GENERATED:prompt-04 START -->

```text
When to use: for each ticket, at the start of a new session.

Ticket <PROJ-123>: <title>.
Goal: <one or two sentences>.
Acceptance criteria:

- <criterion 1>
- <criterion 2>

Follow the full loop and stop at each approval point:

1. `std-plan`: a short plan for this ticket. Wait for my approval.
2. `std-tdd-workflow`: write the failing test first and show the RED output (the test fails for the right reason), then the code, then GREEN.
3. `std-verification`: run it until it reports READY, and show the report.
4. `std-code-review` in a fresh context (a subagent), plus `std-security-review` or `std-db-migration-review` when they apply. Fix or answer every CRITICAL and HIGH finding.
5. Write the pull request body from `.github/pull_request_template.md`, with the evidence it asks for.

Do not run git commands that write (commit, push, branch, merge, rebase); I do those. Never read `.env` or paste secrets or customer data.
```

<!-- AUTO-GENERATED:prompt-04 END -->

### 8.5 Scaffold repo rỗng (05)

Chỉ dùng cho cách b: scaffold bằng CLI chính thức theo các rule của standard, rồi dừng và nhắc bạn chạy lại adopt để điền command.

<!-- AUTO-GENERATED:prompt-05 START -->

```text
When to use: path b of doc 12 only — the standard was adopted in an empty repository and the application does not exist yet.

Scaffold the application for <repository-name> with the official CLI, under the rules of this repository.

Stack: <for example NestJS + MySQL + TypeORM, pnpm>. Extra packages: <for example @nestjs/config zod>.

1. Read `CLAUDE.md` and `.claude/project.json`. Follow `.claude/rules/`.
2. Propose the exact commands first (for example `pnpm dlx @nestjs/cli new . --package-manager pnpm --skip-git`, then `pnpm add ...`) and wait for my approval. Use the official CLI; do not write the skeleton by hand.
3. Do not overwrite `CLAUDE.md`, `.claude/`, `.github/` or `.gitignore` entries the standard added; if the CLI wants to, stop and tell me.
4. Do not run git commands that write.
5. When the skeleton builds, stop. Tell me to commit it and re-run adoption (`node <path-to-standard>/scripts/adopt.mjs --dry-run`, then `--yes`) so the command list in `.claude/project.json` and `CLAUDE.md` is filled from `package.json`.
```

<!-- AUTO-GENERATED:prompt-05 END -->

## 9. Mẹo cho team: template repository

Team hay tạo các service giống nhau có thể giữ một GitHub template repository đã scaffold (cách a) và đã adopt sẵn. Dự án mới bắt đầu bằng **Use this template**, rồi:

- đặt `repoOwner` bằng `node ../team-ai-standards/scripts/adopt.mjs --repo-owner @<org>/<team> --dry-run`, rồi `--yes`;
- điền `CLAUDE.md` bằng prompt 01;
- nhờ owner của standard thêm repo vào `.github/standard-targets.json`.

Bản thân template repository cũng được đăng ký, nên nó nhận pull request cập nhật như mọi repo khác, và dự án mới luôn bắt đầu từ phiên bản hiện tại.
