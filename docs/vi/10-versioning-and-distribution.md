# 10. Đánh version và phân phối bộ tiêu chuẩn

## Mục đích

Cách bộ tiêu chuẩn này được đánh version và phát hành, và cách các project repository áp dụng version mới mà không ai phải push thay đổi trực tiếp vào chúng.

## 1. Số version

Bộ tiêu chuẩn dùng semantic versioning: `MAJOR.MINOR.PATCH`. Version nằm ở ba nơi và phải khớp nhau: `package.json`, `templates/.claude/STANDARD_VERSION` và heading mới nhất trong `CHANGELOG.md`.

| Thay đổi | Mức | Ví dụ |
| --- | --- | --- |
| Developer hoặc repository phải làm khác đi, hoặc một thay đổi template có thể làm hỏng repository đã áp dụng | **MAJOR** | Thêm bước bắt buộc vào quy trình; chính sách dữ liệu chặt hơn; bỏ một quyền khỏi `allow`; đổi tên placeholder; thay đổi format của bảng lệnh được sinh ra trong `CLAUDE.md` (mọi repository phải sinh lại) |
| Thêm mới hoặc chặt hơn nhưng không làm hỏng repository đã áp dụng | **MINOR** | Rule, skill, tài liệu hoặc workflow tuỳ chọn mới; deny rule mới; placeholder mới có giá trị mặc định an toàn |
| Câu chữ, lỗi chính tả, ví dụ, làm rõ mà không đổi ý nghĩa | **PATCH** | Sửa link hỏng; câu chữ tiếng Việt tốt hơn |

Khi major version còn là `0`, các bản minor có thể chứa thay đổi phá vỡ tương thích; những thay đổi đó được đánh dấu **Breaking** trong CHANGELOG.

## 2. Kỷ luật CHANGELOG

- Mỗi PR vào repository này thêm một dòng dưới `## [Unreleased]` trong `CHANGELOG.md`, thuộc một trong các nhóm: Added, Changed, Removed, Fixed, Security.
- Mỗi dòng nói rõ cái gì thay đổi và, nếu cần, các repository đã áp dụng phải làm gì (ví dụ "thay `<unit-test-cmd>` trong settings").
- Thay đổi phá vỡ tương thích bắt đầu bằng **Breaking:**.
- Khi phát hành, `[Unreleased]` được đổi thành `[x.y.z] - YYYY-MM-DD`.
- Tài liệu tiếng Anh và tiếng Việt thay đổi trong cùng một PR; CI kiểm tra cấu trúc của chúng khớp nhau.

## 3. Phát hành

1. Owner of the standard mở release PR: tăng version trong `package.json` và `templates/.claude/STANDARD_VERSION`, ghi ngày cho heading trong CHANGELOG.
2. CI (`standard-ci`) pass: lint, JSON, settings, parity, budget, smoke test.
3. Sau khi merge, owner tạo annotated tag trên `main`: `git tag -a v0.2.0 -m "Team AI standard 0.2.0"` rồi push tag đó.
4. Owner tạo GitHub release từ tag, dùng phần CHANGELOG tương ứng làm release notes.
5. Tag sẽ kích hoạt job cập nhật (mục tiếp theo).

Nhịp phát hành: sau mỗi buổi retrospective của từng wave trong giai đoạn triển khai, sau đó mỗi quý một lần, và phát hành ngay khi có bản sửa lỗi bảo mật.

## 4. Ba lớp trong một project repository

Mỗi repository đã adopt có ba lớp. Mỗi file thuộc đúng một lớp, và mỗi lớp có một owner.

| Lớp | File | Owner | Thay đổi bằng cách |
| --- | --- | --- | --- |
| **1. Standard** | `.claude/rules/std/**`, `.claude/agents/std-*`, `.claude/skills/std-*/**`, `.claude/std/**` (base settings, compose script, hook, manifest), `.claude/settings.json` (được sinh ra), `.claude/STANDARD_VERSION`, `.github/pull_request_template.md`, khối `team-ai-standard` ở cuối `CODEOWNERS`, `.github/workflows/std-check.yml` | Owner of the standard | Chỉ qua pull request cập nhật; không bao giờ sửa trực tiếp trong repository |
| **2. Project** | `CLAUDE.md`, `.claude/project.json` (stack, profile, lệnh, permission rule bổ sung, bật/tắt hook), `.claude/rules/local/**`, phần còn lại của `CODEOWNERS` | Team của repository | Pull request bình thường |
| **3. Personal** | `.claude/settings.local.json` | Từng developer | Không bao giờ commit |

Các lớp ghép với nhau như sau:

- `.claude/settings.json` được `.claude/std/compose-settings.mjs` sinh ra từ base profile (`.claude/std/settings.<profile>.json`, Lớp 1) và `.claude/project.json` (Lớp 2). Các placeholder lệnh như `<unit-test-cmd>` được thay bằng lệnh của project; rule cho những lệnh mà project không có sẽ bị bỏ ra.
- Bảng lệnh trong `CLAUDE.md` nằm giữa các marker `std-commands` và do cùng script đó sinh ra, nên `CLAUDE.md` và settings không bao giờ lệch nhau.
- `.claude/std/manifest.json` ghi hash của mọi file Lớp 1. Workflow `std-check` chạy `compose-settings.mjs --check` trên mọi pull request và báo lỗi khi một file Lớp 1 bị sửa tay, hoặc khi `settings.json` hay bảng lệnh đã cũ.
- Các câu riêng cho từng stack là các fragment ghép được: mỗi fragment cho một framework, một database, một thư viện data access hoặc một mảng tuỳ chọn (AWS). Rule của chúng nằm trong `.claude/rules/std/fragments/<dimension>-<value>.md` (tối đa 150 từ mỗi file), còn ví dụ nằm trong các file cùng tên cạnh hai skill `std-tdd-workflow` và `std-db-migration-review`. Lựa chọn được ghi trong `.claude/project.json` → `stack`, ví dụ `{ "runtime": "node", "framework": "nestjs", "databases": ["mysql"], "dataAccess": "typeorm", "optional": ["aws"] }`. Cách thêm một fragment: tài liệu 11.
- `.claude/STANDARD_VERSION` chứa version mà repository đang dùng; `CLAUDE.md` tham chiếu tới file này thay vì ghi lại con số.

### Personal settings (Layer 3)

Claude Code áp dụng `.claude/settings.local.json` đè lên settings dùng chung, chỉ cho các session của bạn. Theo tài liệu chính thức ("Configure permissions", mục "Settings precedence"): "If a tool is denied at any level, no other level can allow it … if user settings allow a permission and project settings deny it, the deny rule blocks it … deny rules from any scope are evaluated before allow rules." Nghĩa là công cụ đã bị deny ở bất kỳ cấp nào thì không cấp nào khác cho phép lại được, và deny được xét trước allow. Danh sách permission từ các file khác nhau được gộp lại: "Claude Code combines the lists instead of picking one, so each file can add entries without removing another file's" (mỗi file chỉ thêm được mục mới, không xoá được mục của file khác). Và một rule `allow` trong file local "doesn't outrank an `ask` rule from a project or managed file" (không thắng được rule `ask` của project). Vì vậy rule deny và ask của bộ tiêu chuẩn vẫn có hiệu lực khi bạn có file local.

| Được đặt trong `settings.local.json` | Không được |
| --- | --- |
| Model, effort, output style và các tuỳ chọn giao diện khác | Tăng `cleanupPeriodDays` (giữ code của khách hàng trên máy lâu hơn) |
| Thêm rule `deny` hoặc `ask` (chặt hơn cho riêng bạn) | Bật MCP server, plugin hoặc hook chưa được duyệt (tài liệu 05) |
| Thêm rule `allow` cho những lệnh mà bộ tiêu chuẩn không deny cũng không ask (repository nội bộ) | Đặt giá trị `env` làm thay đổi API endpoint, credential hoặc proxy |
| Các lựa chọn "Yes, and don't ask again" mà Claude Code tự lưu vào đây | Dùng file này để lách một rule; hãy đề xuất thay đổi |

Claude Code tự thêm file này vào global git excludes của bạn ở lần đầu nó ghi file. Nếu bạn tự tạo file bằng tay, hãy thêm `.claude/settings.local.json` vào `.gitignore`.

## 5. Pull request cập nhật

Workflow: `.github/workflows/standard-update.yml` trong repository này, đi kèm `scripts/sync-standard.mjs`. Danh sách repository đích nằm trong `.github/standard-targets.json`:

```json
{
  "targets": [
    { "repo": "<org>/<order-sync-service>", "baseBranch": "main" },
    { "repo": "<org>/<client-x-adapter>", "baseBranch": "develop", "enabled": false }
  ]
}
```

Stack và profile không cấu hình ở đây: job đọc chúng từ `.claude/project.json` của từng repository.

Khi một release tag được push, với mỗi repository đích đang bật, job sẽ:

1. Kiểm tra tag, `package.json` và `STANDARD_VERSION` khớp nhau.
2. Checkout repository đích.
3. Chạy `sync-standard.mjs`, script này **chỉ ghi Lớp 1**:
   - ghi lại các file standard và đúng những fragment được chọn trong `.claude/project.json` của repository; xoá các fragment không còn được chọn và các file standard đã bị bỏ ở upstream (chỉ những file có trong manifest);
   - chỉ cập nhật các nhóm tuỳ chọn (ví dụ các kiểm tra tài liệu) nếu repository đã cài chúng;
   - chỉ cập nhật PR template và khối `CODEOWNERS` ở nơi có marker quản lý;
   - sinh lại `.claude/settings.json` từ base profile mới và `.claude/project.json` (không đổi) của repository;
   - ghi `.claude/STANDARD_VERSION` và manifest;
   - không bao giờ thay đổi `CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/` hay `.claude/settings.local.json`.
4. Commit vào một branch mới `chore/ai-standard-v<version>` và mở **một pull request** trong repository đó. Job không bao giờ push vào base branch.
5. Mô tả PR liệt kê các file được cập nhật và bị xoá, mọi permission rule được thêm hoặc bỏ, và những việc cần làm tay. Nếu bản phát hành thay đổi format của bảng lệnh được sinh ra (thay đổi MAJOR, mục 1), mô tả PR có phần "Action required" với đúng lệnh cần chạy trên branch của PR, `node .claude/std/compose-settings.mjs`, kèm lý do: `CLAUDE.md` thuộc về repository nên bản cập nhật không sửa nó, và `std-check` sẽ báo lỗi cho tới khi bảng khớp.

Sau đó:

- Owner của repository review và merge PR như mọi thay đổi khác. Các check bắt buộc và CODEOWNERS vẫn áp dụng.
- Job đăng một thông báo lên chat của team, gồm version, link release notes và danh sách repository đích. Slack là mặc định (`SLACK_WEBHOOK_URL`); đặt `CHAT_PROVIDER=teams` để dùng Microsoft Teams (`TEAMS_WEBHOOK_URL`). Webhook URL chỉ lấy từ GitHub Secrets.

Quyền truy cập:

Job cần quyền ghi vào các repository khác. **Chọn loại credential nào là quyết định cuối cùng của security owner.**

| Phương án | Thiết lập | Lý do |
| --- | --- | --- |
| **Khuyến nghị: GitHub App** | App thuộc sở hữu của organisation, chỉ cài trên các repository đích, có quyền ghi Contents và Pull requests. Biến `STANDARD_APP_CLIENT_ID`, secret `STANDARD_APP_PRIVATE_KEY`. | Job tạo installation token ngắn hạn riêng cho từng repository đích. Không gắn với một người cụ thể, nên vẫn dùng được khi có người nghỉ việc. Mọi PR đều hiển thị là do App mở. |
| Phương án dự phòng: fine-grained personal access token | Token thuộc một tài khoản bot riêng, chỉ giới hạn trong các repository đích, quyền ghi Contents và Pull requests, có ngày hết hạn. Secret `STANDARD_UPDATE_TOKEN`. | Dễ thiết lập, nhưng tồn tại lâu, gắn với một tài khoản, và phải rotate trước khi hết hạn. |

Workflow dùng App khi `STANDARD_APP_CLIENT_ID` được đặt, ngược lại dùng token dự phòng. Không bao giờ dùng classic personal access token hoặc token của một người thật.

- Repository của khách hàng chỉ được thêm vào danh sách đích khi project lead đồng ý, và thường để `enabled: false` cho tới khi quan điểm về AI của khách hàng được xác nhận.

## 6. Áp dụng bộ tiêu chuẩn lần đầu

Chạy script adoption từ project repository (xem 00-quickstart):

```bash
node <path-to-standard>/scripts/adopt.mjs --profile <strict|standard> --dry-run
node <path-to-standard>/scripts/adopt.mjs --profile <strict|standard> --yes
```

Chọn stack:

| Chiều | Flag | Giá trị | Detect từ |
| --- | --- | --- | --- |
| Framework | `--framework` | `nestjs`, `express`, `none` | `@nestjs/core` (thắng `express`), `express`; không tìm thấy gì nghĩa là `none` |
| Database (một hoặc nhiều) | `--db` | `mysql`, `postgres` | `mysql2`/`mysql`, `pg`/`postgres` |
| Data access | `--data-access` | `typeorm`, `raw`, `none` | `typeorm`/`@nestjs/typeorm`; có driver mà không có ORM nghĩa là `raw`; không có database nghĩa là `none` |
| Tuỳ chọn | `--with` / `--without-optional` | `aws` | `@aws-sdk/*`, `aws-sdk`, `aws-cdk-lib`, hoặc thư mục `infra/`, `cdk/` hay `terraform/` |

- Kết quả detect không bao giờ được áp dụng âm thầm. `--dry-run` hiển thị lựa chọn và nguồn gốc của từng giá trị. Một lần chạy thật cần `--yes` để chấp nhận các giá trị đã detect, hoặc flag cho mọi chiều được detect.
- Khi detect không rõ ràng (ví dụ có ORM mà không có driver database), hoặc repo phụ thuộc vào thứ mà bộ tiêu chuẩn chưa có fragment (danh sách `unsupported` trong registry: Fastify, Koa, hapi, Prisma, Drizzle, Kysely, Knex, Sequelize, Mongoose, MongoDB), script dừng lại và không ghi gì. Với dependency chưa có fragment, thông báo nêu tên dependency, nói rõ chưa có fragment, và chỉ tới tài liệu 11 (thêm fragment) hoặc flag rõ ràng. Framework `none` cài fragment cho service Node.js không có web framework; data access `none` không cài gì.
- Flag rõ ràng (hoặc alias) sẽ vượt qua dependency chưa có fragment cho chiều đó. Dependency được ghi vào `.claude/project.json` dưới dạng `"acknowledgedUnsupported": ["@prisma/client"]`, để reviewer thấy repo đang dùng thứ chưa có fragment. `std-check` và PR cập nhật cảnh báo các dependency chưa có fragment mà chưa được ghi nhận (ví dụ thêm sau này), và không cảnh báo lại các dependency đã ghi nhận.
- Các tổ hợp không hợp lệ bị từ chối: thư viện data access mà không có database, có database mà data access là `none`, hoặc giá trị không xác định. Tổ hợp bất thường (hai database, NestJS với raw driver) chỉ đưa ra cảnh báo.
- Các alias từ version trước vẫn dùng được và đặt mọi chiều: `--stack nestjs-mysql` (NestJS + MySQL + TypeORM + AWS), `--stack nestjs-postgres` (NestJS + PostgreSQL + TypeORM + AWS), `--stack node-postgres` (không framework + PostgreSQL + TypeORM + AWS).
- Các giá trị và quy tắc detect nằm trong `templates/fragments/fragments.json`. File này chỉ liệt kê các fragment team đang dùng; fragment mới được thêm theo tài liệu 11.

Script ghi những gì:

- Script tạo các file Lớp 1, `.claude/project.json` với lựa chọn stack và các lệnh điền sẵn từ script trong `package.json` khi tên khớp, một bộ khung `CLAUDE.md` có các mục `TODO(adopt)`, `.claude/STANDARD_VERSION`, và manifest.
- Script không bao giờ ghi đè file đã có. Với `CLAUDE.md`, `.claude/settings.json`, PR template hoặc `CODEOWNERS` đã tồn tại, script ghi `<file>.proposed` cùng một merge checklist trong `.claude/std-adoption-checklist.md`. Workflow `std-check` báo lỗi nếu một file `*.proposed`, checklist hoặc `.claude/settings.local.json` bị commit.
- Script từ chối chạy khi khối `CODEOWNERS` của chính bộ tiêu chuẩn vẫn còn owner placeholder.
- Script không bao giờ commit, push, cài package hay dùng mạng.
- Sau đó owner of the standard thêm repository vào `standard-targets.json`.

## 7. Bỏ qua hoặc hoãn một bản cập nhật

- Owner của repository có thể hoãn một PR cập nhật (ví dụ trong thời gian release freeze), nhưng không quá bản minor tiếp theo.
- Các bản phát hành bảo mật phải được merge trong vòng 5 ngày làm việc.
- Nếu một repository không thể áp dụng một thay đổi, owner ghi lại ngoại lệ với owner of the standard (lý do, ngày kết thúc).
