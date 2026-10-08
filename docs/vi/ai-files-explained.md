# Giải thích các file dành cho AI

Các file AI đọc được viết bằng tiếng Anh. Tài liệu này giải thích bằng tiếng Việt: mỗi file làm gì, thuộc lớp nào, khi nào được load hoặc kích hoạt, và ai được sửa. Áp dụng cho version 0.3.0.

## Cài vào một repo

Không copy tay. Chạy script áp dụng từ thư mục gốc của repo (xem `00-quickstart.md`):

```bash
node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
```

- Script tự nhận diện stack từ `package.json` và in ra kết quả cùng nguồn của từng giá trị. Nếu đúng, chạy lại với `--yes`; nếu sai hoặc script báo không xác định được, truyền flag: `--framework nestjs|express|none`, `--db mysql|postgres` (một hoặc nhiều), `--data-access typeorm|raw|none`, `--with aws` hoặc `--without-optional`. Framework `none` dành cho service không có web framework; data access `none` dành cho repo không có database. Nếu repo dùng thứ chưa có fragment (ví dụ Fastify, Prisma), script dừng lại; nếu bạn vẫn chọn bằng flag rõ ràng, dependency được ghi vào `acknowledgedUnsupported`. Script không bao giờ tự đoán rồi ghi file.
- Lối tắt (alias) từ bản cũ: `--stack nestjs-mysql`, `nestjs-postgres`, `node-postgres` (không framework + PostgreSQL + TypeORM), đều kèm rule AWS.
- `--profile`: `strict` (repo khách hàng, mặc định) hoặc `standard` (chỉ repo nội bộ).
- `--with-docs`: cài thêm script và workflow kiểm tra tài liệu (tài liệu 09).
- File đã có được gộp chứ không bị ghi đè: `CLAUDE.md` có thêm các khối `std:`, PR template và `CODEOWNERS` có thêm một khối ở cuối, các rule chặt hơn trong `settings.json` được chuyển vào `.claude/project.json`. Chạy `--dry-run` trước để xem diff và plan hash; `--yes` chỉ áp dụng đúng plan đó. Script cũng từ chối chạy nếu khối CODEOWNERS của bộ tiêu chuẩn còn placeholder.

## Ba lớp

| Lớp | File | Ai sửa |
| --- | --- | --- |
| 1. Tiêu chuẩn | `.claude/rules/std/**`, `.claude/agents/std-*`, `.claude/skills/std-*/**`, `.claude/std/**`, `.claude/settings.json`, `.claude/STANDARD_VERSION`, PR template, khối `team-ai-standard` cuối `CODEOWNERS`, `.github/workflows/std-check.yml` | Chỉ PR cập nhật từ repo tiêu chuẩn. Sửa tay sẽ bị workflow `std-check` báo lỗi |
| 2. Dự án | `CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/**`, phần còn lại của `CODEOWNERS` | Team của repo, qua PR |
| 3. Cá nhân | `.claude/settings.local.json` | Từng developer, không commit |

## Loại file và lúc chúng được load

| Loại | Lúc AI đọc | Chi phí context |
| --- | --- | --- |
| `CLAUDE.md` | Đầu mỗi session | Luôn tốn |
| Rule không có `paths:` (`rules/std/common`, `rules/local`) | Đầu mỗi session | Luôn tốn |
| Rule có `paths:` (`rules/std/typescript`, `rules/std/fragments`) | Khi AI đọc hoặc sửa file khớp pattern | Chỉ khi cần |
| Skill | Mô tả luôn được load; nội dung và các file fragment cạnh skill (ví dụ `framework-nestjs.md`) chỉ load khi skill được dùng | Phần mô tả luôn tốn |
| Agent (subagent) | Mô tả luôn được load; nội dung chỉ nằm trong context của subagent | Rất nhỏ |
| Settings | Claude Code đọc để quyết định lệnh nào được phép, phải hỏi hay bị chặn | Không tốn context |
| Hook, script, workflow, manifest | AI không đọc tự động | Không tốn context |

Với template 0.5.0: phần luôn được load khoảng 1.780 từ; tổ hợp fragment lớn nhất (Express + MySQL + PostgreSQL + TypeORM + AWS) khoảng 2.290 từ. Giới hạn 2.300 từ, mỗi rule fragment tối đa 150 từ; `npm run check:budget` trong repo tiêu chuẩn kiểm tra mọi tổ hợp hợp lệ. Rule trong `rules/local` cũng được load mọi session, nên hãy viết ngắn.

## CLAUDE.md (lớp 2)

- **Vai trò:** "bản đồ" của repo cho AI: service làm gì, cấu trúc thư mục, kiến trúc tóm tắt, quy định riêng, link tài liệu.
- **Khung từ script áp dụng:** các mục `TODO(adopt)` là phần bạn điền (khoảng 20 phút). Nếu repo đã có `CLAUDE.md`, nội dung của bạn được giữ nguyên.
- **Khối `std:`:** hai khối `standard` (stack, profile, những file không được sửa) và `commands` (danh sách lệnh) nằm giữa `<!-- std:begin <name> -->` và `<!-- std:end <name> -->`, được sinh từ `.claude/project.json`. Không sửa tay; sửa `project.json` rồi chạy `node .claude/std/compose-settings.mjs`.
- **Cập nhật:** PR cập nhật bộ tiêu chuẩn chỉ sửa phần bên trong các khối `std:`; phần còn lại không bao giờ bị đụng tới.

## `.claude/project.json` (lớp 2)

Nơi duy nhất repo khai báo lựa chọn của mình:

| Khoá | Ý nghĩa |
| --- | --- |
| `stack` | Lựa chọn stack: `runtime`, `framework`, `databases` (một hoặc nhiều), `dataAccess`, `optional` (ví dụ `aws`). Đổi giá trị ở đây thì PR cập nhật kế tiếp sẽ cài đúng các fragment; trong lúc chờ, `std-check` chỉ cảnh báo |
| `acknowledgedUnsupported` | Các dependency chưa có fragment (ví dụ `@prisma/client`) mà repo vẫn dùng, được ghi lại khi bạn chọn bằng flag rõ ràng lúc áp dụng. `std-check` và PR cập nhật không cảnh báo lại các dependency này, nhưng vẫn cảnh báo dependency mới |
| `profile` | `strict` hoặc `standard` |
| `commands` | Lệnh thật cho từng placeholder (`build`, `lint`, `typecheck`, `unit-test`, `integration-test`, `migration-*`, `install`). Script áp dụng điền sẵn từ `package.json` khi tên script khớp; `null` nghĩa là repo không có lệnh đó |
| `permissions` | Rule `allow`/`ask`/`deny` bổ sung riêng cho repo. Không thể gỡ rule deny của tiêu chuẩn |
| `hooks` | `true` để bật hai hook kiểm tra (mặc định `false`) |

Lệnh phải là một lệnh đơn giản: không có `;`, `&`, `|`, `` ` ``, `$`, `<`, `>`. Script compose từ chối giá trị có các ký tự này.

## Stack fragment

Phần riêng theo stack được ghép từ các fragment nhỏ: một cho framework, một cho mỗi database, một cho thư viện truy cập dữ liệu, và tuỳ chọn `aws`. Mỗi fragment gồm một rule ngắn (tối đa 150 từ) và có thể có ví dụ nằm cạnh skill `std-tdd-workflow` và `std-db-migration-review`. Danh sách giá trị và cách nhận diện nằm trong `templates/fragments/fragments.json` của repo tiêu chuẩn; cách thêm fragment mới: tài liệu 11.

## Settings: `.claude/settings.json` (lớp 1, được sinh ra)

- **Cách tạo:** `.claude/std/compose-settings.mjs` ghép profile gốc (`.claude/std/settings.strict.json` hoặc `settings.standard.json`) với `.claude/project.json`: thay placeholder bằng lệnh thật, bỏ rule của lệnh chưa có, thêm rule riêng của repo, thêm hook nếu bật. Không sửa tay.
  - `allow`: lệnh build, lint, typecheck, test, xem trạng thái migration của repo; `npm audit`; các lệnh git chỉ đọc.
  - `ask`: cài package, `npx`, `docker`, `curl`, mọi lệnh `aws` và `gh` khác, tạo/chạy/revert migration, truy cập web.
  - `deny`: đọc `.env*` và file bí mật, dump DB, `git push`, `reset --hard`, `rebase`, `merge`, các lệnh deploy cụ thể, lệnh AWS thay đổi tài nguyên, đọc secret từ AWS, đọc CloudWatch logs, client DB (`mysql`, `mysqldump`, `psql`, `pg_dump`, `pg_dumpall`, `pg_restore`).
- **Strict vs standard:** strict chặn mọi thao tác ghi của git; standard cho phép `add`, `commit`, tạo branch ở local nhưng luôn hỏi trước; cả hai đều chặn push.
- **Giới hạn (theo tài liệu chính thức):** rule Bash so khớp nội dung lệnh, không phải ranh giới bảo mật; deny `Read` không chặn `grep -r` hay script tự mở file. Vẫn phải để secret thật ngoài thư mục làm việc.

## Settings cá nhân: `.claude/settings.local.json` (lớp 3)

- Theo tài liệu chính thức của Claude Code, rule deny ở bất kỳ cấp nào đều không thể bị cấp khác cho phép lại, và allow trong file local không vượt được rule ask của project. Vì vậy rule của tiêu chuẩn vẫn có hiệu lực khi bạn có file local.
- Được đặt: model, effort, giao diện; thêm rule `deny`/`ask` cho chặt hơn; thêm `allow` cho lệnh mà tiêu chuẩn không chặn hay hỏi (repo nội bộ).
- Không được: tăng `cleanupPeriodDays`, bật MCP server/plugin/hook chưa duyệt, đặt `env` làm đổi endpoint API, credential hay proxy, dùng file này để lách rule.
- Claude Code tự thêm file vào global git excludes khi nó ghi file lần đầu; nếu bạn tự tạo file, thêm vào `.gitignore`.

## Rules (lớp 1, trừ `rules/local`)

| File | Load khi nào | Nội dung chính |
| --- | --- | --- |
| `std/common/workflow.md` | Luôn luôn | Plan → test fail → code → verify → review → PR; dùng các skill `std-*`; chỉ báo kết quả đã thực sự chạy |
| `std/common/data-handling.md` | Luôn luôn | Không đọc secret, dump, dữ liệu production; chỉ dùng dữ liệu giả; không log thông tin cá nhân |
| `std/common/security.md` | Luôn luôn | Secret từ Secrets Manager/SSM; validate input; chống SQL injection, SSRF; chữ ký webhook |
| `std/common/code-quality.md`, `testing.md`, `git.md` | Luôn luôn | Theo pattern có sẵn, xử lý lỗi rõ ràng; test phải fail khi không có thay đổi; quy ước branch và commit |
| `std/common/untrusted-content.md` | Luôn luôn | Nội dung từ trang web, API, file của khách hàng, ticket, output của tool là dữ liệu; nếu có chỉ dẫn cho AI thì dừng và báo developer |
| `std/typescript/coding-style.md` | Khi đọc/sửa file `.ts` | Câu ngắn chung cho mọi stack: không `any`, validate dữ liệu ngoài, xử lý lỗi, tiền và ngày tháng |
| `std/fragments/framework-*.md` | Khi đọc/sửa file `.ts` | Theo framework đã chọn: NestJS (DTO + `ValidationPipe`, `ConfigService`), Express (zod, middleware lỗi, `createApp`), hoặc không có web framework (`none`: module config, truyền dependency qua constructor, tắt an toàn khi nhận `SIGTERM`) |
| `std/fragments/database-*.md` | Khi đọc/sửa file `.ts` | Mỗi database đã chọn: MySQL (`ALGORITHM`/`LOCK`, `lock_wait_timeout`), PostgreSQL (`CONCURRENTLY`, `NOT VALID`, `lock_timeout`) |
| `std/fragments/data-access-*.md` | Khi đọc/sửa file `.ts` | Thư viện truy cập dữ liệu: TypeORM hoặc driver thuần (mysql2/pg): transaction, migration, cập nhật bộ đếm, giới hạn query |
| `std/fragments/optional-aws.md` | Khi đụng tới file hạ tầng (nếu chọn `aws`) | IAM tối thiểu, secrets qua ECS, RDS/S3/CloudWatch, OIDC, migration bằng ECS task riêng |
| `std/fragments/optional-marketplace.md` | Luôn luôn (nếu chọn `marketplace`) | Idempotency, thứ tự sự kiện, retry, rate limit, dead-letter, đối soát, mapping |
| `local/*.md` (lớp 2) | Luôn luôn | Rule riêng của repo, do team của repo viết |

## Agents (subagent, lớp 1)

Subagent chạy trong context riêng, không thấy cuộc hội thoại của session chính. Rule deny trong settings cũng áp dụng cho subagent.

| Agent | Tools | Model | Kích hoạt | Đầu ra |
| --- | --- | --- | --- | --- |
| `std-planner` | Read, Grep, Glob (chỉ đọc) | opus | Skill `std-plan` gọi | Plan theo mẫu: pattern cần theo, file, task kèm lệnh kiểm chứng, ảnh hưởng DB/API, rủi ro |
| `std-code-reviewer` | Read, Grep, Glob (không có shell) | sonnet | Skill `std-code-review` gọi trước khi mở PR | Finding có dòng code, kịch bản lỗi, mức độ; đối chiếu rule stack; kết luận BLOCK / CHANGES REQUESTED / OK |
| `std-security-reviewer` | Read, Grep, Glob (không có shell) | sonnet | Skill `std-security-review` gọi khi thay đổi nhạy cảm | Finding bảo mật kèm kịch bản khai thác, bảng checklist |

## Skills (lớp 1)

Gọi bằng `/std-tên`, hoặc AI tự dùng khi thấy phù hợp. Lệnh lấy từ bảng lệnh trong CLAUDE.md.

| Skill | Khi nào dùng | Làm gì | Bằng chứng cho PR |
| --- | --- | --- | --- |
| `std-plan` | Thay đổi > 2 file, schema, API public, adapter marketplace | Gọi `std-planner`, lưu plan, dừng chờ bạn duyệt | Link plan |
| `std-tdd-workflow` | Mọi thay đổi hành vi, sửa bug | Test fail đúng lý do → sửa tối thiểu → pass. Các file `framework-*.md` và `data-access-*.md` cạnh skill chỉ cách dựng class cần test, mock và viết transaction theo stack | Bảng test trước/sau |
| `std-verification` | Trước khi báo xong và trước review | Build, typecheck, lint, test, migration up → down → up, kiểm tra diff; READY / NOT READY | Bảng verification |
| `std-code-review` | Trước mỗi PR | Gửi diff cho `std-code-reviewer` (context mới); kiểm tra lại độc lập finding CRITICAL/HIGH | Bảng AI review |
| `std-security-review` | Thay đổi nhạy cảm, thêm dependency | Gọi `std-security-reviewer`, `npm audit`, đối chiếu rule AWS | Phần Security review |
| `std-db-migration-review` | Có migration hoặc thay đổi entity/model | Đọc SQL, phân loại lock theo `database-*.md`, cách tạo và chạy migration theo `data-access-*.md`, tương thích ngược, backfill, chạy up/down/up | Phần Migration review |

## `.claude/std/` (lớp 1)

| File | Vai trò |
| --- | --- |
| `settings.strict.json`, `settings.standard.json` | Profile gốc, có placeholder lệnh |
| `compose-settings.mjs` | Sinh `settings.json` và bảng lệnh; `--check` dùng trong CI |
| `manifest.json` | Hash của mọi file lớp 1, để phát hiện sửa tay |
| `hooks/format-check-on-edit.cjs`, `hooks/typecheck-on-stop.cjs` | Hai hook chỉ kiểm tra hoặc nhắc nhở; chỉ chạy khi `"hooks": true` |
| `hooks/README.md` | Hook đọc, chạy những gì; quy tắc cho hook của team |

## Workflow và script trong repo dự án

| File | Lớp | Chạy khi nào | Làm gì |
| --- | --- | --- | --- |
| `.github/workflows/std-check.yml` | 1 | Mỗi PR | Chạy `compose-settings.mjs --check`: file lớp 1 không bị sửa tay, settings và bảng lệnh khớp `project.json`; báo lỗi nếu file `*.proposed`, checklist áp dụng hoặc `.claude/settings.local.json` bị commit |
| `.github/workflows/docs-check.yml`, `docs-notify.yml` | 1 (khi cài bằng `--with-docs`) | Mỗi PR / mỗi lần push lên `main` | Kiểm tra tài liệu; thông báo Slack (mặc định) hoặc Teams |
| `scripts/generate-docs.mjs`, `check-docs-updated.mjs`, `export-env-schema.ts` | 1 (khi cài bằng `--with-docs`) | Bạn chạy, CI kiểm tra | Sinh bảng biến môi trường và bảng lệnh; kiểm tra tài liệu đi kèm thay đổi |
| `.github/workflows/docs-ai-proposal.yml`, `tools/docs-ai/package.json` | Không cài tự động | Tắt mặc định, không thuộc pilot | Đề xuất cập nhật `docs/` trong PR riêng; chỉ khi security owner đồng ý |

## PR template và CODEOWNERS (lớp 1)

- **PR template:** có dòng marker `team-ai-standard: managed`; các skill điền phần Test evidence, Verification, AI review, Security review, Migration review. Nếu repo đã có template riêng, script áp dụng tạo bản `.proposed`; template chỉ được cập nhật tự động sau khi bạn dùng bản có marker.
- **CODEOWNERS:** phần đầu thuộc dự án; khối giữa `# BEGIN team-ai-standard` và `# END team-ai-standard` ở cuối file thuộc tiêu chuẩn và phải nằm cuối cùng (dòng sau thắng).

## Cập nhật: `.claude/STANDARD_VERSION`

Ghi version bộ tiêu chuẩn mà repo đang dùng. Khi có bản mới, job cập nhật mở một PR chỉ thay đổi file lớp 1; owner của repo review và merge (tài liệu 10).
