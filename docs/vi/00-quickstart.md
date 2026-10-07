# 00. Bắt đầu nhanh

Một trang dành cho developer. Bạn không cần đọc các tài liệu khác để bắt đầu; chúng giải thích lý do đằng sau.

## Áp dụng bộ tiêu chuẩn vào một repository (khoảng 30 phút)

1. **Xem trước plan.** Từ thư mục gốc của repository, với một bản checkout của bộ tiêu chuẩn nằm ngay bên cạnh:

    ```bash
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
    ```

    - Script detect framework, database, thư viện data access và việc dùng AWS từ `package.json` rồi hiển thị ra. Nếu sai, hoặc script báo detect không rõ ràng, hãy truyền flag: `--framework nestjs|express|none`, `--db mysql|postgres` (một hoặc nhiều), `--data-access typeorm|raw|none`, `--with aws` hoặc `--without-optional`. Framework `none` dành cho service không có web framework (worker, consumer); data access `none` dành cho repo không có database. Nếu repo dùng thứ mà bộ tiêu chuẩn chưa có fragment (ví dụ Fastify hay Prisma), script sẽ dừng: nhờ owner of the standard thêm fragment (tài liệu 11), hoặc truyền flag rõ ràng; khi đó dependency được ghi vào `.claude/project.json` ở mục `acknowledgedUnsupported`.
    - Lối tắt: `--stack nestjs-mysql`, `nestjs-postgres` hoặc `node-postgres` (không framework + PostgreSQL + TypeORM), tất cả đều kèm rule AWS.
    - `--profile`: `strict` cho repository của khách hàng (mặc định), `standard` chỉ cho repository nội bộ. Không chắc? Dùng `strict`.
    - Mọi tuỳ chọn, giá trị mặc định và nơi được lưu: [README, Tuỳ chọn của adopt.mjs](../../README.md#tuỳ-chọn-của-adoptmjs). Các lựa chọn của bạn được lưu trong `.claude/project.json`; lần chạy sau dùng lại chúng trừ khi bạn truyền flag.
    - Script không ghi gì. Kết quả liệt kê mọi file sẽ tạo, diff của mọi file sẽ sửa, các permission rule được chuyển từ settings của bạn sang hoặc bị bỏ (kèm lý do), và một plan hash.
    - Mục **Decisions required** liệt kê những gì chỉ con người quyết định được, kèm flag cần truyền: `--repo-owner @org/team` khi repo chưa có `CODEOWNERS`, `--carry-allow "<rule>"` hoặc `--drop-allow "<rule>"` (hoặc `--drop-allow-rest`) cho từng rule `allow` trong settings của bạn mà profile không cấp, flag stack khi detect không rõ ràng. Thêm flag rồi chạy lại `--dry-run`.
2. **Áp dụng đúng plan đó** trên một branch mới với working tree sạch, cùng các flag, dùng `--yes` thay cho `--dry-run`:

    ```bash
    git switch -c chore/adopt-ai-standard
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
    ```

    - Nếu có gì thay đổi kể từ lần dry run (một file, một flag, version của bộ tiêu chuẩn), script dừng và yêu cầu chạy lại `--dry-run`. Script cũng dừng, kèm các lệnh git cần chạy, khi working tree chưa sạch hoặc bạn đang ở default branch.
    - Nội dung của bạn được giữ nguyên. `CLAUDE.md` có thêm hai khối sau phần giới thiệu, giữa `<!-- std:begin standard -->` / `<!-- std:end standard -->` và tương tự cho `commands`; PR template và `CODEOWNERS` có thêm một khối ở cuối; `.claude/settings.json` được sinh lại, các rule chặt hơn của bạn được chuyển vào `.claude/project.json`. Những heading có thể trùng với một khối (ví dụ mục "Commands" của bạn) được liệt kê là gợi ý dọn dẹp, không bao giờ bị xoá tự động.
    - Để hoàn tác trước khi commit: `git restore .` và `git clean -fd` (kiểm tra trước bằng `git clean -nd`).
3. **Điền thông tin dự án.** Với `CLAUDE.md` mới, hoàn thành các mục `TODO(adopt)`. Đặt những lệnh hiển thị `not set` trong `.claude/project.json`, rồi chạy `node .claude/std/compose-settings.mjs`.
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

Khi bộ tiêu chuẩn phát hành version mới, repository của bạn nhận một pull request tên `chore: update team AI standard to vX.Y.Z`. PR này chỉ thay đổi các file standard và phần bên trong các khối std của `CLAUDE.md`, và liệt kê những gì đã đổi. Hãy review như mọi PR khác rồi merge. Phần còn lại của `CLAUDE.md`, `.claude/project.json` và các rule local của bạn không bao giờ bị bản cập nhật thay đổi.

## Hỏi ai

- Câu hỏi về quy trình hoặc template: wave champion hoặc owner of the standard.
- Câu hỏi về dữ liệu, bảo mật, duyệt công cụ, hoặc nghi ngờ lộ dữ liệu: security owner, ngay trong ngày.
- Tên người phụ trách: xem bảng Named people trong tài liệu 03.
