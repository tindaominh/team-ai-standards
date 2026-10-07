# 09. Giữ tài liệu luôn cập nhật

## Mục đích

Khoảng mười developer dùng chung các repository. Tài liệu bị lỗi thời khi không ai chịu trách nhiệm cập nhật, và gây conflict khi mọi người cùng sửa một file lớn. Tài liệu này quy định ai được phép thay đổi tài liệu một cách tự động, mỗi bước kiểm tra chạy ở đâu, và cách tránh conflict.

## Nguyên tắc

1. **Công cụ local chỉ nhắc nhở; CI bắt buộc; con người duyệt.** Không có gì trên máy developer tự ghi vào file dùng chung.
2. **Nội dung sinh tự động thì luôn được sinh bằng script, không bao giờ sửa tay.** Những bảng có thể suy ra từ code sẽ do script tạo.
3. **Mọi thay đổi tài liệu đều đi qua pull request** và được review như code.
4. **Tài liệu nhỏ, tập trung một chủ đề**, để các công việc song song hiếm khi đụng cùng một file.

## 1. Hook Claude Code ở local: chỉ nhắc nhở

- Hook của team chỉ được kiểm tra hoặc nhắc nhở (xem 05 và `.claude/std/hooks/README.md`).
- Hook có thể báo cho Claude hoặc developer "env schema đã thay đổi; hãy cập nhật docs/configuration.md". Hook không bao giờ tự sửa tài liệu, không commit và không push.
- Lý do: hook local mà ghi vào file dùng chung sẽ tạo ra thay đổi chưa được review, gây conflict giữa các developer và làm diff có những thay đổi bất ngờ.

## 2. Kiểm tra CI trên pull request

Workflow: `templates/.github/workflows/docs-check.yml`, đi kèm `templates/scripts/check-docs-updated.mjs`.

| Nếu PR thay đổi | Thì PR cũng phải thay đổi |
| --- | --- |
| `config/env.schema.json`, `config/env.example`, `src/config/**` | `docs/`, `README.md` hoặc `CLAUDE.md` |
| `scripts` trong `package.json` | `docs/`, `README.md` hoặc `CLAUDE.md` |
| `.github/workflows/**` | `docs/`, `README.md` hoặc `CLAUDE.md` |

Bypass có kiểm soát:

- Khi không cần thay đổi tài liệu, một **reviewer** gắn label `docs-not-needed`.
- Check chỉ chấp nhận label nếu người gắn label **không phải là tác giả PR**. Job summary ghi lại ai đã gắn label.
- Reviewer xác nhận trong một comment trên PR vì sao không cần thay đổi tài liệu.
- Tạo label này một lần cho mỗi repository.

Cùng workflow này cũng sẽ fail khi các generated section đã cũ (xem mục tiếp theo).

## 3. Generated section

Một phần tài liệu được suy ra từ code. Phần đó nằm giữa các marker và được tạo bởi `scripts/generate-docs.mjs` (template: `templates/scripts/generate-docs.mjs`).

```markdown
<!-- BEGIN GENERATED: env-vars -->
(generated table)
<!-- END GENERATED: env-vars -->
```

| Tên section | Nguồn | Nội dung |
| --- | --- | --- |
| `env-vars` | `config/env.schema.json`, được export từ zod env schema | Biến, bắt buộc hay không, giá trị mặc định, có phải secret không, mô tả. Biến secret không bao giờ hiển thị giá trị. |
| `commands` | `scripts` trong `package.json` (+ mô tả tuỳ chọn trong `scriptsInfo`) | Lệnh, lệnh đó chạy gì, mô tả |

Quy tắc:

- Không ai sửa tay nội dung bên trong marker. Hãy sửa nguồn, rồi chạy `node scripts/generate-docs.mjs` và commit kết quả.
- Script chỉ ghi lại phần text giữa các marker và là idempotent: chạy hai lần cũng không thay đổi gì thêm.
- CI chạy `node scripts/generate-docs.mjs --check`. Khi một section đã cũ, job fail và in ra lệnh cần chạy.
- Generated section đặt trong `docs/` hoặc `README.md`, không đặt trong `CLAUDE.md`. CLAUDE.md giữ bảng lệnh viết tay, vì AI cần bảng ánh xạ chứ không cần mọi script.

### Biến môi trường lấy từ zod schema

Các service NestJS của team validate configuration bằng zod. Cùng một schema đó cũng là nguồn cho tài liệu, nên mô tả chỉ cần viết một lần.

1. **Schema** nằm trong một file duy nhất, `src/config/env.schema.ts`, mỗi biến đều có `.describe()`. Đánh dấu secret bằng `.meta({ 'x-secret': true })`:

    ```ts
    import { z } from 'zod';

    export const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development').describe('Runtime environment'),
      PORT: z.coerce.number().int().positive().default(3000).describe('HTTP port'),
      DB_HOST: z.string().min(1).describe('MySQL host'),
      DB_PASSWORD: z.string().min(1).describe('MySQL password').meta({ 'x-secret': true }),
    });

    export type Env = z.infer<typeof envSchema>;

    export function validateEnv(config: Record<string, unknown>): Env {
      return envSchema.parse(config);
    }
    ```

2. **Validate khi khởi động** bằng `@nestjs/config`: `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`. Ứng dụng sẽ không khởi động nếu configuration không hợp lệ.
3. **Export** bằng `templates/scripts/export-env-schema.ts`, chạy qua `npm run docs:env-schema` (trong package.json: `"docs:env-schema": "<ts-runner> scripts/export-env-schema.ts"`, dùng TypeScript runner mà repository đang có). Script ghi ra `config/env.schema.json` bằng `z.toJSONSchema(envSchema, { io: 'input' })`. Chế độ `input` rất quan trọng: nhờ nó, các biến có giá trị mặc định không bị liệt kê là bắt buộc. File này cũng ghi lại đường dẫn nguồn và SHA-256 của nó (`x-source`, `x-source-sha256`).
4. **Sinh tài liệu** bằng `node scripts/generate-docs.mjs`, rồi commit cả `config/env.schema.json` lẫn tài liệu đã cập nhật.

Generator sẽ fail với thông báo rõ ràng khi `config/env.schema.json` không tồn tại, hoặc khi file đã cũ (zod source đã thay đổi sau lần export cuối). Thông báo ghi rõ lệnh cần chạy. Hãy giữ toàn bộ env schema trong đúng một file nguồn, nếu không thì hash sẽ không nhận ra thay đổi.

Các version của zod:

- **zod v4 (khuyến nghị):** `z.toJSONSchema` có sẵn, không cần cài thêm gì. Template và ví dụ đều giả định dùng v4.
- **zod v3:** cần package hỗ trợ `zod-to-json-schema`, pin version cụ thể trong `devDependencies`. Trong script export, thay `z.toJSONSchema(...)` bằng `zodToJsonSchema(envSchema)`; package này vốn đã coi các biến có giá trị mặc định là không bắt buộc. v3 không có `.meta()`, nên hãy liệt kê tên các biến secret trong script export và thêm `'x-secret': true` cho các property đó ngay tại đó. Nên lên kế hoạch nâng lên v4.

## 4. Job AI cập nhật tài liệu (tuỳ chọn)

Workflow: `templates/.github/workflows/docs-ai-proposal.yml`. **Mặc định tắt và nằm ngoài phạm vi pilot Wave 1.** Job này gửi nội dung repository tới nhà cung cấp AI. Muốn bật cần có đủ tất cả các điều kiện sau:

- Phê duyệt bằng văn bản của security owner. Không bao giờ bật trong repository của khách hàng, trừ khi quan điểm về AI bằng văn bản của khách hàng cho phép.
- CLI được cài từ một file `tools/docs-ai/package.json` đã commit (template: `templates/tools/docs-ai/package.json`) kèm `package-lock.json` đã được review, bằng lệnh `npm ci --ignore-scripts`. npm kiểm tra mọi package theo integrity hash trong lockfile và không chạy install script nào. **Không bao giờ dùng `npx`.** Tạo lockfile bằng `npm install --package-lock-only --ignore-scripts --prefix tools/docs-ai`. Vì install script bị bỏ qua, workflow khởi chạy CLI qua `cli-wrapper.cjs` của package.
- Secret `ANTHROPIC_API_KEY` từ tài khoản công ty, và biến repository `DOCS_AI_PROPOSAL_ENABLED=true`.

Chức năng: sau một lần merge vào `main` không đụng tới `docs/`, Claude Code đọc các file đã thay đổi và có thể đề xuất cập nhật tài liệu dưới dạng một **pull request riêng**.

Guardrail:

| Guardrail | Cách thực hiện |
| --- | --- |
| Tắt trừ khi được bật rõ ràng | Chỉ chạy khi biến repository `DOCS_AI_PROPOSAL_ENABLED` là `true` |
| Pin version công cụ | Version cụ thể trong `tools/docs-ai/package.json`, cài từ lockfile bằng `npm ci --ignore-scripts` |
| Tối thiểu công cụ | Chỉ có Read, Grep, Glob và Edit; chỉ được sửa trong `docs/`; không có shell, không truy cập web |
| Không tự động đồng ý | Các yêu cầu cấp quyền không có ai trả lời sẽ bị từ chối (`--permission-prompts none`) |
| Giới hạn | Số lượt tối đa và ngân sách chi phí cho mỗi lần chạy; timeout cho job |
| Không để credential trong tầm với | Checkout không lưu credential; token chỉ dùng ở bước push cuối cùng |
| Kiểm tra phạm vi | Job fail nếu có file nào ngoài `docs/` bị thay đổi |
| Kiểm tra secret | Job fail nếu diff khớp với các pattern secret thường gặp |
| Không bao giờ vào main | Chỉ push một branch mới `docs-ai/<sha>` và mở PR |
| Con người review | CODEOWNERS của `docs/` phải approve; ai cũng có thể đóng PR |

PR được mở bằng token của workflow sẽ không kích hoạt các workflow khác; reviewer đóng rồi mở lại PR để chạy các check thông thường.

## 5. Thông báo khi merge

Workflow: `templates/.github/workflows/docs-notify.yml`.

- Kích hoạt: push lên `main` có đụng tới `docs/**`, `CLAUDE.md` hoặc `.claude/**`.
- Nội dung tin nhắn: repository, tiêu đề commit, tác giả, đường dẫn các file đã thay đổi (tối đa 20) và một link. Không bao giờ có nội dung file hay diff.
- **Slack là provider mặc định.** Microsoft Teams là phương án thay thế đã làm sẵn: đặt biến repository `CHAT_PROVIDER=teams` để chuyển từ bước Slack sang bước Teams.
- Webhook URL chỉ lấy từ GitHub Secrets: `SLACK_WEBHOOK_URL` hoặc `TEAMS_WEBHOOK_URL`. Không bao giờ đặt chúng trong file. Hãy rotate webhook nếu nó từng bị lộ.
- Nếu secret của provider được chọn chưa được đặt, job ghi một notice vào log và không làm gì.
- Provider khác: thêm một bước theo cùng pattern (tin nhắn lấy từ file, URL hoặc token lấy từ secret), sau khi security owner phê duyệt.

## 6. Quyền sở hữu

- `templates/.github/CODEOWNERS` giao `docs/`, `README.md`, `CLAUDE.md`, `.claude/` và các workflow cho các owner.
- Bật "Require review from Code Owners" trên base branch, để mọi thay đổi về cấu hình AI và tài liệu dùng chung luôn được owner review.

## 7. Tránh conflict

- **Chia theo chủ đề.** Mỗi chủ đề một tài liệu (configuration, deployment, một channel adapter, một runbook) thay vì một file lớn.
- **Giữ CLAUDE.md ngắn và ổn định.** Chi tiết đặt trong `docs/`; CLAUDE.md chỉ link tới. Chỉ sửa CLAUDE.md khi lệnh, cấu trúc thư mục hoặc quy định bắt buộc thay đổi.
- **PR nhỏ.** Thay đổi tài liệu đi cùng thay đổi code cần nó, không gom thành một đợt lớn về sau.
- **Generated section** loại bỏ nguyên nhân gây conflict phổ biến nhất: bảng sửa tay.
- **Rebase thường xuyên** với các branch tồn tại lâu có đụng tới docs. Việc này do developer làm; AI không bao giờ rebase branch dùng chung.

## 8. Checklist thiết lập cho một repository

`node <path-to-standard>/scripts/adopt.mjs --with-docs` cài các script cùng hai workflow `docs-check` và `docs-notify`, và giữ chúng luôn được cập nhật theo bộ tiêu chuẩn. Checklist dưới đây lo phần còn lại.

- [ ] Chạy script adoption với `--with-docs` (hoặc, với repository đã adopt, nhờ owner of the standard); thêm npm script `docs:env-schema`.
- [ ] Thêm marker ở những chỗ cần bảng sinh tự động; chạy generator; commit.
- [ ] Tạo label `docs-not-needed`.
- [ ] Điền owner trong `CODEOWNERS` và bật code-owner review.
- [ ] Tuỳ chọn: đặt `SLACK_WEBHOOK_URL` cho `docs-notify.yml` (hoặc `CHAT_PROVIDER=teams` và `TEAMS_WEBHOOK_URL`).
- [ ] Không làm trong pilot. Về sau, chỉ khi security owner đã phê duyệt: copy `docs-ai-proposal.yml` và `tools/docs-ai/package.json`, commit lockfile, rồi bật job.
