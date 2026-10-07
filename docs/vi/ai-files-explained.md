# Giải thích các file dành cho AI

Các file trong `templates/` được viết bằng tiếng Anh vì AI đọc chúng. Tài liệu này giải thích bằng tiếng Việt: mỗi file làm gì, khi nào được load hoặc kích hoạt, và khi nào bạn cần chỉnh sửa. Áp dụng cho version 0.2.0.

## Cách cài vào một repo

| File trong `templates/` | Copy tới | Ghi chú |
| --- | --- | --- |
| `CLAUDE.md` | `<repo>/CLAUDE.md` | Điền hết các chỗ `<...>`, nhất là bảng lệnh (Commands) |
| `.claude/settings.json` | `<repo>/.claude/settings.json` | Profile **strict**, mặc định cho repo của khách hàng |
| `.claude/settings.standard.json` | `<repo>/.claude/settings.json` (đổi tên) | Profile **standard**, chỉ dùng cho repo nội bộ |
| `.claude/STANDARD_VERSION` | `<repo>/.claude/STANDARD_VERSION` | Version của bộ tiêu chuẩn mà repo đang dùng |
| `.claude/rules/**` | `<repo>/.claude/rules/**` | Giữ nguyên cấu trúc thư mục |
| `.claude/agents/*.md` | `<repo>/.claude/agents/` | |
| `.claude/skills/*/SKILL.md` | `<repo>/.claude/skills/` | Mỗi skill là một thư mục |
| `.github/pull_request_template.md` | `<repo>/.github/` | |
| `.github/CODEOWNERS` | `<repo>/.github/` | Thay `<org>/<team>` bằng team thật, bật "Require review from Code Owners" |
| `.github/workflows/docs-*.yml` | `<repo>/.github/workflows/` | Xem tài liệu 09; `docs-ai-proposal.yml` không dùng trong pilot, chỉ bật khi security owner đồng ý |
| `scripts/*` | `<repo>/scripts/` | Dùng cho các workflow docs; thêm npm script `docs:env-schema` cho `export-env-schema.ts` |
| `tools/docs-ai/package.json` | `<repo>/tools/docs-ai/` | Chỉ khi bật job AI docs (không thuộc pilot); commit kèm lockfile đã review |
| `hooks/*` | `<repo>/.claude/hooks/` | Không bắt buộc, chỉ cài khi team của repo đồng ý |

## Loại file và lúc chúng được load

| Loại | Lúc AI đọc | Chi phí context |
| --- | --- | --- |
| `CLAUDE.md` | Đầu mỗi session | Luôn tốn |
| Rule không có `paths:` | Đầu mỗi session | Luôn tốn |
| Rule có `paths:` | Khi AI đọc hoặc sửa file khớp pattern | Chỉ khi cần |
| Skill | Mô tả (`description`) luôn được load; nội dung chỉ load khi skill được dùng | Phần mô tả luôn tốn, nội dung thì không |
| Agent (subagent) | Mô tả luôn được load; nội dung chỉ nằm trong context của subagent | Rất nhỏ với session chính |
| Settings | Claude Code đọc để quyết định lệnh nào được phép, phải hỏi hay bị chặn | Không tốn context |
| Hook | Script chạy tự động theo sự kiện | Không tốn context (trừ lời nhắc hook gửi cho AI) |
| `STANDARD_VERSION`, workflow, script | AI không đọc tự động | Không tốn context |

Tổng phần luôn được load (CLAUDE.md + rule không có `paths:` + mô tả skill/agent) trong template 0.2.0 khoảng 1.790 từ; trường hợp xấu nhất (thêm cả rule TypeScript và AWS) khoảng 2.210 từ. Cả hai giới hạn đều là 2.300 từ, kiểm tra bằng `npm run check:budget` trong repo tiêu chuẩn. Rule chỉ chứa các câu ngắn, kiểm tra được; ví dụ code nằm trong skill.

## CLAUDE.md

- **Vai trò:** "bản đồ" của repo cho AI: service làm gì, cấu trúc thư mục (theo module NestJS), bảng lệnh, kiến trúc tóm tắt, quy định riêng của repo, link tài liệu.
- **Bảng lệnh (Commands):** mỗi placeholder (`<build-cmd>`, `<lint-cmd>`, `<typecheck-cmd>`, `<unit-test-cmd>`, `<integration-test-cmd>`, `<migration-show-cmd>`, `<migration-generate-cmd>`, `<migration-run-cmd>`, `<migration-revert-cmd>`) được điền bằng lệnh thật của repo. Skill và PR template đọc bảng này, nên đổi tên npm script chỉ cần sửa một chỗ (cộng với settings).
- **Kích hoạt:** luôn được load.
- **Khi nào sửa:** khi lệnh, cấu trúc hoặc quy định của repo thay đổi. Giữ dưới 150 dòng. Job cập nhật bộ tiêu chuẩn **không bao giờ** sửa file này.

## Settings: `.claude/settings.json`

- **Vai trò:** lớp kiểm soát thật sự (không phụ thuộc vào việc AI có "nghe lời" hay không). Hai file profile được sinh từ `scripts/build-settings.mjs` trong repo tiêu chuẩn, nên strict và standard luôn đồng bộ.
  - `allow`: chạy không cần hỏi: lệnh build, lint, typecheck, unit test, integration test, xem trạng thái migration (dưới dạng placeholder, phải thay bằng lệnh thật), `npm audit`, các lệnh git chỉ đọc.
  - `ask`: phải hỏi bạn trước: cài package, `npx`, `docker`, `curl`, mọi lệnh `aws` và `gh` khác, tạo/chạy/revert migration, truy cập web.
  - `deny`: luôn bị chặn: đọc `.env*` và file bí mật, dump DB, `git push`, `reset --hard`, `rebase`, `merge`, các lệnh deploy cụ thể (`npm run deploy*`, `cdk deploy`, `serverless`/`sls deploy`, `terraform apply`, `aws ecs update-service`, `aws ecs run-task`, …), lệnh AWS tạo/sửa/xoá tài nguyên, đọc secret từ AWS, đọc CloudWatch logs, `mysql`/`mysqldump`.
- **Placeholder chưa điền:** không khớp với lệnh nào, nên lệnh đó chỉ đơn giản là phải hỏi. Không nguy hiểm, nhưng gây phiền; hãy điền khi cài.
- **Strict vs standard:**
  - **strict** (repo khách hàng, mặc định): chặn mọi thao tác ghi của git, kể cả `add`, `commit`, `checkout`, `stash`.
  - **standard** (repo nội bộ): cho phép `add`, `commit`, tạo branch ở local nhưng luôn hỏi bạn trước; vẫn chặn push.
- **Thiết lập khác:** `disableBypassPermissionsMode: "disable"` (đã đối chiếu với tài liệu chính thức), không tự bật MCP server của repo, lịch sử session lưu trên máy tối đa 14 ngày.
- **Giới hạn (theo tài liệu chính thức của Claude Code):** rule Bash so khớp nội dung lệnh AI viết ra, không phải là ranh giới bảo mật; cùng chương trình gọi qua đường dẫn đầy đủ, `sh -c` hay script sẽ không bị khớp. Rule deny `Read` có chặn `cat`, `head`, `tail`, `sed`, `tee` và redirection, nhưng không chặn `grep -r` hay script tự mở file. Rule deny áp dụng cho cả subagent. Vì vậy vẫn phải để secret thật ngoài thư mục làm việc; sandbox của Claude Code sẽ được đánh giá trong Wave 1.
- **Tuỳ chỉnh cá nhân:** đặt trong `.claude/settings.local.json` (không commit). Chỉ được làm chặt hơn, không được nới deny list ở repo khách hàng nếu chưa có duyệt của security owner.

## Rules: `.claude/rules/`

| File | Load khi nào | Nội dung chính |
| --- | --- | --- |
| `common/workflow.md` | Luôn luôn | Quy trình plan → test fail → code → verify → review → PR; không code trước khi plan được duyệt; chỉ báo kết quả đã thực sự chạy |
| `common/data-handling.md` | Luôn luôn | Không đọc secret, dump, dữ liệu production; chỉ dùng dữ liệu giả; không log thông tin cá nhân; không gửi nội dung repo ra ngoài |
| `common/security.md` | Luôn luôn | Secret lấy từ Secrets Manager/SSM; validate input; chống SQL injection, SSRF; kiểm tra chữ ký webhook |
| `common/code-quality.md` | Luôn luôn | Theo pattern có sẵn; hàm ngắn; xử lý lỗi rõ ràng; không để `console.log`; cập nhật tài liệu |
| `common/testing.md` | Luôn luôn | Test phải fail khi không có thay đổi; mock ở biên HTTP/SDK; test các trường hợp lỗi |
| `common/git.md` | Luôn luôn | Tên branch, Conventional Commits với `Refs: PROJ-123`; AI không push/merge/rebase |
| `common/marketplace-integration.md` | Luôn luôn (có thể giới hạn theo `paths:` sau pilot nếu thiếu budget) | Idempotency, thứ tự sự kiện, retry, rate limit, dead-letter, đối soát, mapping |
| `common/aws.md` | Khi đụng tới file hạ tầng (`infra/`, `cdk/`, `*.tf`, task definition, workflow CI, Dockerfile) | IAM tối thiểu, secrets qua ECS, RDS/S3/CloudWatch, OIDC, chạy migration bằng ECS task riêng |
| `typescript/coding-style.md` | Khi đọc/sửa file `.ts` | Không dùng `any`; DTO với class-validator và `ValidationPipe`; dữ liệu ngoài và config validate bằng zod; config đọc qua `ConfigService`; dependency injection của NestJS; promise, tiền, ngày tháng |
| `typescript/typeorm.md` | Khi đọc/sửa file `.ts` | Các câu ngắn về NestJS + TypeORM: không `synchronize`/`migrationsRun`; `forFeature` + `@InjectRepository` trong provider; transaction trong service; migration qua TypeORM CLI, chạy bằng task riêng trước khi deploy; khoá khi cập nhật tồn kho. Ví dụ code nằm trong skill `tdd-workflow` và `db-migration-review` |

## Agents (subagent): `.claude/agents/`

Subagent chạy trong context riêng, không thấy cuộc hội thoại của session chính. Nhờ vậy reviewer đánh giá code một cách độc lập. Rule deny trong settings cũng áp dụng cho subagent.

| Agent | Tools | Model | Kích hoạt | Đầu ra |
| --- | --- | --- | --- | --- |
| `planner` | Read, Grep, Glob (chỉ đọc) | opus | Skill `plan` gọi, hoặc bạn yêu cầu | Plan theo mẫu: pattern cần theo, file, task kèm lệnh kiểm chứng, ảnh hưởng DB/API, rủi ro |
| `code-reviewer` | Read, Grep, Glob (chỉ đọc, không có shell) | sonnet | Skill `code-review` gọi trước khi mở PR | Finding có dòng code, kịch bản lỗi, mức độ (kể cả kiểm tra riêng cho NestJS/TypeORM); kết luận BLOCK / CHANGES REQUESTED / OK |
| `security-reviewer` | Read, Grep, Glob (chỉ đọc, không có shell) | sonnet | Skill `security-review` gọi khi thay đổi đụng tới auth, credential, webhook, HTTP ra ngoài, S3, IAM, dữ liệu cá nhân | Finding bảo mật kèm kịch bản khai thác, bảng checklist |

Reviewer không có shell nên session chính phải đưa diff cho chúng (skill `code-review` đã làm việc này).

## Skills: `.claude/skills/`

Gọi bằng `/tên-skill`, hoặc AI tự dùng khi thấy phù hợp với mô tả. Các lệnh trong skill lấy từ bảng lệnh của CLAUDE.md.

| Skill | Khi nào dùng | Làm gì | Bằng chứng cho PR |
| --- | --- | --- | --- |
| `plan` | Thay đổi > 2 file, schema, API public, adapter marketplace | Gọi `planner`, lưu plan vào `docs/plans/`, dừng chờ bạn duyệt | Link plan |
| `tdd-workflow` | Mọi thay đổi hành vi, sửa bug | Viết test (unit với `Test.createTestingModule` + `getRepositoryToken`, integration với MySQL local) → chạy thấy fail đúng lý do → sửa tối thiểu → chạy lại thấy pass | Bảng test trước/sau |
| `verification` | Trước khi báo xong và trước review | Chạy build, typecheck, lint, test, migration (up → down → up ở local) và kiểm tra diff; báo READY / NOT READY; nếu placeholder chưa điền thì hỏi | Bảng verification |
| `code-review` | Trước mỗi PR | Gửi diff cho `code-reviewer` (context mới); kiểm tra lại độc lập các finding CRITICAL/HIGH | Bảng AI review |
| `security-review` | Thay đổi nhạy cảm, thêm dependency | Gọi `security-reviewer`, `npm audit`, đối chiếu rule AWS | Phần Security review |
| `db-migration-review` | Có migration hoặc thay đổi entity | Đọc SQL, phân loại ALGORITHM/LOCK, rủi ro metadata lock, tương thích ngược, backfill, cấu hình NestJS (`synchronize`/`migrationsRun` tắt), chạy up/down/up ở local | Phần Migration review |

## Hooks (không bắt buộc): `templates/hooks/`

Mặc định **không bật**. Hook của team **chỉ được kiểm tra hoặc nhắc nhở**: không ghi hay sửa file, không ghi file dùng chung, không commit/push, không gọi mạng, không gửi dữ liệu ra khỏi máy.

| Hook | Sự kiện | Làm gì | Ảnh hưởng tới AI |
| --- | --- | --- | --- |
| `format-check-on-edit.cjs` | Sau mỗi lần AI sửa/ghi file | Chạy Prettier cài sẵn trong `node_modules` ở chế độ `--check` cho file vừa sửa (bỏ qua `.env*` và file ngoài repo); không sửa file | Nếu file chưa đúng format, thêm một lời nhắc cạnh kết quả tool; không chặn |
| `typecheck-on-stop.cjs` | Khi AI kết thúc một lượt | Chạy `tsc --noEmit` | Nếu có lỗi type, báo cho AI tiếp tục sửa (tối đa một lần mỗi lượt) |

Đuôi `.cjs` giúp hook chạy được cả trong project CommonJS lẫn ES module. Chi tiết xem `templates/hooks/README.md`.

## Tài liệu tự động: workflow và script

Không phải file AI đọc, nhưng liên quan trực tiếp tới việc dùng AI an toàn. Chi tiết ở tài liệu 09.

| File | Chạy khi nào | Làm gì |
| --- | --- | --- |
| `.github/workflows/docs-check.yml` | Mỗi PR | Kiểm tra phần tự sinh còn mới không; thay đổi config schema, npm script hay workflow phải kèm thay đổi tài liệu, trừ khi reviewer (không phải tác giả) gắn label `docs-not-needed` |
| `.github/workflows/docs-notify.yml` | Push lên `main` có đụng `docs/`, `CLAUDE.md`, `.claude/` | Gửi tin ngắn (repo, tiêu đề commit, người commit, danh sách file, link) vào Slack (mặc định, secret `SLACK_WEBHOOK_URL`) hoặc Microsoft Teams (`CHAT_PROVIDER=teams`, secret `TEAMS_WEBHOOK_URL`) |
| `.github/workflows/docs-ai-proposal.yml` | Tắt mặc định, không thuộc pilot | Nếu security owner đồng ý: sau khi merge, AI đề xuất cập nhật `docs/` trong một PR **riêng**, không bao giờ push lên `main`. CLI cài từ `tools/docs-ai` bằng lockfile và `npm ci --ignore-scripts`, không dùng `npx` |
| `scripts/export-env-schema.ts` | Bạn chạy (`npm run docs:env-schema`) khi đổi zod env schema | Xuất `config/env.schema.json` từ zod schema (zod v4, `z.toJSONSchema`), kèm hash của file nguồn |
| `scripts/generate-docs.mjs` | Bạn chạy, CI kiểm tra | Sinh lại bảng biến môi trường và bảng lệnh giữa các marker `BEGIN/END GENERATED`; không đụng phần còn lại; báo lỗi rõ ràng nếu `config/env.schema.json` thiếu hoặc đã cũ |
| `scripts/check-docs-updated.mjs` | Trong `docs-check.yml` | Logic kiểm tra "có cập nhật tài liệu chưa" và label bypass |

## PR template: `.github/pull_request_template.md`

Không phải file cho AI, nhưng các skill điền vào đó: phần Test evidence, Verification (lệnh ghi đúng như đã chạy), AI review, Security review và Migration review. Reviewer dùng cùng với checklist ở tài liệu 04.

## Version: `.claude/STANDARD_VERSION`

Ghi version bộ tiêu chuẩn mà repo đang dùng. Khi có bản mới, job cập nhật mở một PR vào repo; owner của repo review và merge (tài liệu 10).
