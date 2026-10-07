# Giải thích các file dành cho AI

Các file trong `templates/` được viết bằng tiếng Anh vì AI đọc chúng. Tài liệu này giải thích bằng tiếng Việt: mỗi file làm gì, khi nào được load hoặc kích hoạt, và khi nào bạn cần chỉnh sửa.

## Cách cài vào một repo

| File trong `templates/` | Copy tới | Ghi chú |
|---|---|---|
| `CLAUDE.md` | `<repo>/CLAUDE.md` | Điền hết các chỗ `<...>` |
| `.claude/settings.json` | `<repo>/.claude/settings.json` | Profile **strict**, mặc định cho repo của khách hàng |
| `.claude/settings.standard.json` | `<repo>/.claude/settings.json` (đổi tên) | Profile **standard**, chỉ dùng cho repo nội bộ |
| `.claude/rules/**` | `<repo>/.claude/rules/**` | Giữ nguyên cấu trúc thư mục |
| `.claude/agents/*.md` | `<repo>/.claude/agents/` | |
| `.claude/skills/*/SKILL.md` | `<repo>/.claude/skills/` | Mỗi skill là một thư mục |
| `.github/pull_request_template.md` | `<repo>/.github/` | |
| `hooks/*` | `<repo>/.claude/hooks/` | Không bắt buộc, chỉ cài khi team của repo đồng ý |

## Loại file và lúc chúng được load

| Loại | Lúc AI đọc | Chi phí context |
|---|---|---|
| `CLAUDE.md` | Đầu mỗi session | Luôn tốn |
| Rule không có `paths:` | Đầu mỗi session | Luôn tốn |
| Rule có `paths:` | Khi AI đọc hoặc sửa file khớp pattern | Chỉ khi cần |
| Skill | Mô tả (`description`) luôn được load; nội dung chỉ load khi skill được dùng | Phần mô tả luôn tốn, nội dung thì không |
| Agent (subagent) | Mô tả luôn được load; nội dung chỉ nằm trong context của subagent | Rất nhỏ với session chính |
| Settings | Claude Code đọc để quyết định lệnh nào được phép, phải hỏi hay bị chặn | Không tốn context |
| Hook | Script chạy tự động theo sự kiện | Không tốn context (trừ khi hook báo lỗi cho AI) |

## CLAUDE.md

- **Vai trò:** "bản đồ" của repo cho AI: service làm gì, cấu trúc thư mục, lệnh chính xác để build/test/lint, kiến trúc tóm tắt, các quy định riêng của repo, link tài liệu.
- **Kích hoạt:** luôn được load.
- **Khi nào sửa:** khi lệnh, cấu trúc hoặc quy định của repo thay đổi. Giữ dưới 150 dòng.
- **Lưu ý:** dòng "Client / confidentiality" và "Settings profile" phải đúng với loại repo.

## Settings: `.claude/settings.json`

- **Vai trò:** lớp kiểm soát thật sự (không phụ thuộc vào việc AI có "nghe lời" hay không). Có 3 danh sách:
  - `allow`: chạy không cần hỏi (build, typecheck, lint, test, `git status/diff/log`...).
  - `ask`: phải hỏi bạn trước (cài package, `npx`, `docker`, `curl`, mọi lệnh `aws` và `gh` khác, truy cập web).
  - `deny`: luôn bị chặn (đọc `.env*` và file bí mật, dump DB, `git push`, `reset --hard`, `rebase`, `merge`, lệnh deploy, lệnh AWS tạo/sửa/xoá tài nguyên, đọc secret từ AWS, đọc CloudWatch logs, `mysql`/`mysqldump`).
- **Strict vs standard:**
  - **strict** (repo khách hàng, mặc định): chặn mọi thao tác ghi của git, kể cả `add`, `commit`, `checkout`, `stash`.
  - **standard** (repo nội bộ): cho phép `add`, `commit`, tạo branch ở local nhưng luôn hỏi bạn trước; vẫn chặn push.
- **Thiết lập khác trong file:** tắt chế độ bypass permissions; không tự bật MCP server của repo; lịch sử session lưu trên máy tối đa 14 ngày.
- **Giới hạn:** rule so khớp theo nội dung lệnh, nên không phải sandbox tuyệt đối. Vẫn phải để secret thật ngoài thư mục làm việc. Rule chặn chữ "deploy" cũng chặn những lệnh vô hại có chữ đó, ví dụ `grep deploy`; những lệnh đó bạn tự chạy.
- **Tuỳ chỉnh cá nhân:** đặt trong `.claude/settings.local.json` (không commit). Chỉ được làm chặt hơn, không được nới deny list ở repo khách hàng nếu chưa có duyệt của security owner.

## Rules: `.claude/rules/`

| File | Load khi nào | Nội dung chính |
|---|---|---|
| `common/workflow.md` | Luôn luôn | Quy trình plan → test fail → code → verify → review → PR; không code trước khi plan được duyệt; chỉ báo kết quả đã thực sự chạy |
| `common/data-handling.md` | Luôn luôn | Không đọc secret, dump, dữ liệu production; chỉ dùng dữ liệu giả; không log thông tin cá nhân; không gửi nội dung repo ra ngoài |
| `common/security.md` | Luôn luôn | Secret lấy từ Secrets Manager/SSM; validate input; chống SQL injection, SSRF; kiểm tra chữ ký webhook |
| `common/code-quality.md` | Luôn luôn | Theo pattern có sẵn; hàm ngắn; xử lý lỗi rõ ràng; không để `console.log`; cập nhật tài liệu |
| `common/testing.md` | Luôn luôn | Test phải fail khi không có thay đổi; mock ở biên HTTP/SDK; test các trường hợp lỗi |
| `common/git.md` | Luôn luôn | Tên branch, Conventional Commits với `Refs: PROJ-123`; AI không push/merge/rebase |
| `common/marketplace-integration.md` | Luôn luôn | Idempotency, thứ tự sự kiện, retry, rate limit, dead-letter, đối soát, mapping |
| `common/aws.md` | Khi đụng tới file hạ tầng (`infra/`, `cdk/`, `*.tf`, task definition, workflow CI, Dockerfile) | IAM tối thiểu, secrets qua ECS, RDS/S3/CloudWatch, OIDC, chạy migration bằng ECS task riêng |
| `typescript/coding-style.md` | Khi đọc/sửa file `.ts` | Không dùng `any`, type rõ ràng, validate dữ liệu ngoài, xử lý promise, tiền và ngày tháng |
| `typescript/typeorm.md` | Khi đọc/sửa file `.ts` | Không `synchronize`, review migration, transaction, khoá dòng, giới hạn query, ghi chú cho NestJS |

## Agents (subagent): `.claude/agents/`

Subagent chạy trong context riêng, không thấy cuộc hội thoại của session chính. Nhờ vậy reviewer đánh giá code một cách độc lập.

| Agent | Tools | Model | Kích hoạt | Đầu ra |
|---|---|---|---|---|
| `planner` | Read, Grep, Glob (chỉ đọc) | opus | Skill `plan` gọi, hoặc bạn yêu cầu | Plan theo mẫu: pattern cần theo, file, task kèm lệnh kiểm chứng, ảnh hưởng DB/API, rủi ro |
| `code-reviewer` | Read, Grep, Glob (chỉ đọc, không có shell) | sonnet | Skill `code-review` gọi trước khi mở PR | Danh sách finding có dòng code, kịch bản lỗi, mức độ; kết luận BLOCK / CHANGES REQUESTED / OK |
| `security-reviewer` | Read, Grep, Glob (chỉ đọc, không có shell) | sonnet | Skill `security-review` gọi khi thay đổi đụng tới auth, credential, webhook, HTTP ra ngoài, S3, IAM, dữ liệu cá nhân | Finding bảo mật kèm kịch bản khai thác, bảng checklist |

Reviewer không có shell nên session chính phải đưa diff cho chúng (skill `code-review` đã làm việc này).

## Skills: `.claude/skills/`

Gọi bằng `/tên-skill`, hoặc AI tự dùng khi thấy phù hợp với mô tả.

| Skill | Khi nào dùng | Làm gì | Bằng chứng cho PR |
|---|---|---|---|
| `plan` | Thay đổi > 2 file, schema, API public, adapter marketplace | Gọi `planner`, lưu plan vào `docs/plans/`, dừng chờ bạn duyệt | Link plan |
| `tdd-workflow` | Mọi thay đổi hành vi, sửa bug | Viết test → chạy thấy fail đúng lý do → sửa tối thiểu → chạy lại thấy pass | Bảng test trước/sau |
| `verification` | Trước khi báo xong và trước review | Chạy build, typecheck, lint, test, kiểm tra migration và diff; báo READY / NOT READY | Bảng verification |
| `code-review` | Trước mỗi PR | Gửi diff cho `code-reviewer` (context mới); kiểm tra lại độc lập các finding CRITICAL/HIGH | Bảng AI review |
| `security-review` | Thay đổi nhạy cảm, thêm dependency | Gọi `security-reviewer`, `npm audit`, đối chiếu rule AWS | Phần Security review |
| `db-migration-review` | Có migration hoặc thay đổi entity | Đọc SQL, phân loại ALGORITHM/LOCK, rủi ro metadata lock, tương thích ngược, backfill, chạy up/down/up ở local | Phần Migration review |

## Hooks (không bắt buộc): `templates/hooks/`

Mặc định **không bật**. Chỉ bật khi team của repo đồng ý, bằng cách gộp `settings.hooks.example.json` vào settings.

| Hook | Sự kiện | Làm gì | Có chặn không |
|---|---|---|---|
| `format-on-edit.js` | Sau mỗi lần AI sửa/ghi file | Chạy Prettier cài sẵn trong `node_modules` cho file vừa sửa (bỏ qua `.env*` và file ngoài repo) | Không |
| `typecheck-on-stop.js` | Khi AI kết thúc một lượt | Chạy `tsc --noEmit`; nếu có lỗi thì báo cho AI tiếp tục sửa (tối đa một lần mỗi lượt) | Có, một lần, khi có lỗi type |

Cả hai hook không gọi mạng, không tải gì về, chỉ dùng công cụ đã cài trong project. Chi tiết xem `templates/hooks/README.md`.

## PR template: `.github/pull_request_template.md`

Không phải file cho AI, nhưng các skill điền vào đó: phần Test evidence, Verification, AI review, Security review và Migration review. Reviewer dùng cùng với checklist ở tài liệu 04.
