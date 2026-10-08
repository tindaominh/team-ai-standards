# 11. Thêm một stack fragment

## Mục đích

Một fragment dạy AI về một phần trong stack của repository: một framework, một database, một thư viện data access, hoặc một mảng tuỳ chọn như AWS hay tích hợp marketplace. Các repository ghép các fragment lại với nhau, nên thêm một giá trị (ví dụ Koa hoặc Kysely) không làm số file tăng theo cấp số nhân. Tài liệu này dành cho người mở rộng bộ tiêu chuẩn; developer chỉ áp dụng bộ tiêu chuẩn thì không cần đọc.

## Fragment hoạt động thế nào

| File trong `templates/fragments/<folder>/<value>/` | Được cài vào project repository thành | Được load |
| --- | --- | --- |
| `rule.md` (bắt buộc) | `.claude/rules/std/fragments/<folder>-<value>.md` | Khi đọc hoặc sửa file khớp `paths:` của nó |
| `tdd.md` (tuỳ chọn) | `.claude/skills/std-tdd-workflow/<folder>-<value>.md` | Chỉ khi skill TDD chạy |
| `migration.md` (tuỳ chọn) | `.claude/skills/std-db-migration-review/<folder>-<value>.md` | Chỉ khi skill review migration chạy |

- `<folder>` là `framework`, `database`, `data-access` hoặc `optional`.
- Registry `templates/fragments/fragments.json` liệt kê các giá trị được phép, label, tên dependency dùng để detect chúng, và các biến template (ví dụ `DB_TYPE` cho database).
- `adopt.mjs` và job cập nhật cài đúng những fragment được chọn trong `.claude/project.json` của repository, và gỡ những fragment không còn được chọn.
- Các biến template như `{{DB_LABEL}}`, `{{DB_TYPE}}` và `{{DB_PORT}}` được điền từ các database đã chọn.

## Các bước

1. **Đăng ký giá trị** trong `templates/fragments/fragments.json`, dưới đúng chiều: một `label`, tên dependency trong `detect` (dấu `/*` ở cuối khớp với cả một scope như `@aws-sdk/*`), và với database thì thêm `vars`. Dùng `outranks` khi một dependency thường kéo theo dependency khác (như NestJS với Express). Nếu dependency đang nằm trong danh sách `unsupported`, xoá nó khỏi danh sách đó.
2. **Viết rule** từ `templates/fragments/_TEMPLATE.md` vào `templates/fragments/<folder>/<value>/rule.md`:
   - giữ phần front matter `paths:`;
   - chỉ gồm các câu ngắn, kiểm tra được, mỗi câu một dòng;
   - **tối đa 150 từ** bên dưới front matter;
   - không lặp lại điều mà chiều khác đã nói (ví dụ, fragment framework không nói gì về migration).
3. **Đặt ví dụ trong skill, không đặt trong rule.** Code minh hoạ cách dựng class cần test, mock data access hoặc viết transaction đặt trong `tdd.md`. Cách tạo, cấu hình và chạy migration đặt trong `migration.md`. Chúng chỉ được load khi skill chạy, nên không tính vào context budget.
4. **Kiểm tra tổ hợp.** Nếu giá trị mới không thể dùng cùng một số giá trị khác, thêm quy tắc vào `validate()` trong `scripts/lib/standard.mjs` (lỗi cho tổ hợp không thể, cảnh báo cho tổ hợp bất thường).
5. **Thêm test** trong `scripts/smoke-test.mjs`. Test chạy trên một bản sao tạm của bộ tiêu chuẩn; hãy đọc giá trị mong đợi từ bản sao đó (giá trị trong registry, khối CODEOWNERS) thay vì viết cứng nội dung hiện tại, và dùng các dependency giả `fixture-*` cho trường hợp dependency chưa có fragment:
   - detect: một `package.json` có dependency mới chọn đúng giá trị mới;
   - không rõ ràng: nếu có thể đụng với một giá trị đã có, việc detect phải dừng lại và nêu tên cả hai;
   - cài đặt: adopt với flag mới cài rule (và file skill) mà không còn sót `{{…}}`;
   - sync: chuyển sang và chuyển khỏi giá trị mới sẽ thêm và gỡ các file của nó.
6. **Chạy các kiểm tra:** `npm run check`. Kiểm tra budget tính mọi tổ hợp hợp lệ; tổ hợp lớn nhất phải ở mức tối đa 2.300 từ, và mỗi fragment rule tối đa 150 từ.
7. **Cập nhật tài liệu:** thêm giá trị vào bảng flag trong tài liệu 10 và vào `docs/vi/ai-files-explained.md`, và ghi vào `CHANGELOG.md` (fragment mới là thay đổi MINOR).

## Checklist review cho một fragment mới

- [ ] Đã đăng ký trong `fragments.json` với cách detect không thể âm thầm chọn sai giá trị.
- [ ] `rule.md` có `paths:` và tối đa 150 từ gồm các câu kiểm tra được.
- [ ] Ví dụ nằm trong `tdd.md` / `migration.md`, không nằm trong rule.
- [ ] Các tổ hợp không thể bị từ chối trong `validate()`.
- [ ] Smoke test bao phủ detect, trường hợp không rõ ràng, cài đặt và sync.
- [ ] `npm run check` pass; tổ hợp xấu nhất được báo cáo nằm trong budget.
- [ ] Tài liệu 10, `ai-files-explained.md` và CHANGELOG đã được cập nhật.
