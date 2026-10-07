# 00. Bắt đầu nhanh

Một trang dành cho developer. Bạn không cần đọc các tài liệu khác để bắt đầu; chúng giải thích lý do đằng sau.

## Áp dụng bộ tiêu chuẩn vào một repository (khoảng 30 phút)

1. **Chạy script adoption** từ thư mục gốc của repository, với một bản checkout của bộ tiêu chuẩn nằm ngay bên cạnh. Trước tiên, xem script detect được gì:

    ```bash
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
    ```

    - Script detect framework, database, thư viện data access và việc dùng AWS từ `package.json` rồi hiển thị ra. Nếu đúng, chạy lại với `--yes`. Nếu sai, hoặc script báo detect không rõ ràng, hãy truyền flag: `--framework nestjs|express|none`, `--db mysql|postgres` (một hoặc nhiều), `--data-access typeorm|raw|none`, `--with aws` hoặc `--without-optional`. Framework `none` dành cho service không có web framework (worker, consumer); data access `none` dành cho repo không có database. Nếu repo dùng thứ mà bộ tiêu chuẩn chưa có fragment (ví dụ Fastify hay Prisma), script sẽ dừng: nhờ owner of the standard thêm fragment (tài liệu 11), hoặc truyền flag rõ ràng; khi đó dependency được ghi vào `.claude/project.json` ở mục `acknowledgedUnsupported`.
    - Lối tắt: `--stack nestjs-mysql`, `nestjs-postgres` hoặc `node-postgres` (không framework + PostgreSQL + TypeORM), tất cả đều kèm rule AWS.
    - `--profile`: `strict` cho repository của khách hàng (mặc định), `standard` chỉ cho repository nội bộ. Không chắc? Dùng `strict`.
    - Thêm `--with-docs` để cài luôn các kiểm tra tài liệu (tài liệu 09).
2. **Điền thông tin dự án.** Hoàn thành các mục `TODO(adopt)` trong `CLAUDE.md`, đặt những lệnh còn đánh dấu `TODO` trong `.claude/project.json`, rồi chạy `node .claude/std/compose-settings.mjs`. Thay `<org>/<repo-team>` trong `CODEOWNERS`.
3. **Merge các đề xuất, nếu có.** Script không bao giờ ghi đè file của bạn. Nếu nó tạo ra các file `*.proposed`, hãy làm theo `.claude/std-adoption-checklist.md`, sau đó xoá các file đề xuất và checklist.
4. **Kiểm tra rồi mở PR.** Chạy `node .claude/std/compose-settings.mjs --check`, mở pull request, và nhờ owner of the standard đăng ký repository để nhận các bản cập nhật.

## Quy trình hằng ngày

- **Plan trước** với mọi việc lớn hơn một bản sửa nhỏ: `/std-plan`. Duyệt plan trước khi viết code.
- **Test trước:** `/std-tdd-workflow`. Test phải fail đúng lý do, rồi mới pass.
- **Verify trước khi báo "xong":** `/std-verification` cho tới khi báo READY.
- **Review với góc nhìn mới:** `/std-code-review` (và `/std-security-review` hoặc `/std-db-migration-review` khi áp dụng). Sửa hoặc trả lời mọi finding CRITICAL và HIGH.
- **Mở PR kèm bằng chứng** mà template yêu cầu. Người review và merge là con người. Không bao giờ dán secret, dữ liệu khách hàng hay dữ liệu production vào AI.

## Thay đổi ở đâu

| Bạn muốn thay đổi | Sửa ở đây | Lớp |
| --- | --- | --- |
| Mô tả dự án, cấu trúc thư mục, kiến trúc, rule riêng của repository | `CLAUDE.md` | Project |
| Lệnh build, test hoặc migration | `.claude/project.json` → `commands`, rồi chạy `node .claude/std/compose-settings.mjs` | Project |
| Permission rule bổ sung cho repository này | `.claude/project.json` → `permissions`, rồi chạy cùng lệnh trên | Project |
| Rule dài hơn của dự án | một file mới trong `.claude/rules/local/` | Project |
| Tuỳ chọn riêng của bạn (model, rule chặt hơn) | `.claude/settings.local.json` (không bao giờ commit) | Personal |
| Framework, database hoặc data access mà repository dùng | `.claude/project.json` → `stack`; PR cập nhật kế tiếp sẽ cài các rule tương ứng (hoặc nhờ owner of the standard chạy ngay) | Project |
| Mọi thứ trong `.claude/rules/std/`, agent và skill `std-*`, `.claude/std/`, `.claude/settings.json` | Không sửa ở đây: đề xuất thay đổi vào repository của bộ tiêu chuẩn (stack mới: tài liệu 11) | Standard |

Workflow `std-check` sẽ báo lỗi pull request nào sửa tay các file standard.

## Bản cập nhật đến bằng cách nào

Khi bộ tiêu chuẩn phát hành version mới, repository của bạn nhận một pull request tên `chore: update team AI standard to vX.Y.Z`. PR này chỉ thay đổi các file standard và liệt kê những gì đã đổi. Hãy review như mọi PR khác rồi merge. `CLAUDE.md`, `.claude/project.json` và các rule local của bạn không bao giờ bị bản cập nhật thay đổi.

## Hỏi ai

- Câu hỏi về quy trình hoặc template: wave champion hoặc owner of the standard.
- Câu hỏi về dữ liệu, bảo mật, duyệt công cụ, hoặc nghi ngờ lộ dữ liệu: security owner, ngay trong ngày.
- Tên người phụ trách: xem bảng Named people trong tài liệu 03.
