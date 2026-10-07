# 04. Checklist review PR (thay đổi có AI hỗ trợ)

## Mục đích

Dùng checklist này khi review bất kỳ PR nào có AI hỗ trợ. Tiêu chuẩn giống như mọi PR khác. Các mục dưới đây tập trung vào những lỗi mà thay đổi có AI hỗ trợ hay mắc.

## Trước khi bắt đầu

- [ ] CI xanh: lint, typecheck, test, commitlint, secret scan.
- [ ] Mô tả PR có đủ mọi mục bằng chứng, hoặc có lý do vì sao một mục không áp dụng.
- [ ] Kích thước diff đủ nhỏ để review. Yêu cầu tách PR nếu vượt khoảng 600 dòng thay đổi (không tính code generate).

## 1. Phạm vi và mục đích

- [ ] Thay đổi khớp với ticket Backlog và plan đã duyệt.
- [ ] Không có chỉnh sửa ngoài lề: đổi tên, format lại, refactor "tiện tay", file thừa.
- [ ] Không có yêu cầu tự nghĩ ra: behaviour mà không ai yêu cầu.

## 2. Tính đúng đắn

- [ ] Logic đúng cho trường hợp bình thường, edge case và trường hợp lỗi. Đọc code, đừng chỉ dựa vào test.
- [ ] Lỗi được xử lý. Không có `catch` rỗng, không có giá trị mặc định âm thầm, không làm mất promise rejection.
- [ ] Code async có `await` những gì cần await. Không có race condition giữa các worker trên cùng một record.
- [ ] Các thao tác ghi nhiều bước dùng transaction.
- [ ] Mapping (status, SKU, field) xử lý giá trị không xác định một cách tường minh.

## 3. Test có ý nghĩa

- [ ] Lần chạy "before" trong bằng chứng thực sự fail đúng lý do mong đợi.
- [ ] Test kiểm tra behaviour và kết quả, không kiểm tra chi tiết implementation hay việc mock được gọi.
- [ ] Test sẽ fail nếu code mới bị xoá hoặc bị hỏng. Thử hình dung xoá một dòng rồi kiểm tra.
- [ ] Có test cho các trường hợp lỗi: timeout, 429/5xx, trùng lặp, event sai thứ tự, input không hợp lệ.
- [ ] Dữ liệu test là dữ liệu giả lập. Không có tên, email, số điện thoại, địa chỉ hay dữ liệu đơn hàng thật.
- [ ] Không có test nào bị nới lỏng, skip hoặc xoá chỉ để bộ test pass, trừ khi PR giải thích lý do.

## 4. Secret và dữ liệu

- [ ] Không có secret, token, key, connection string hay file `.env*` trong diff, test, fixture hoặc nội dung PR.
- [ ] Không có dữ liệu cá nhân trong log, thông báo lỗi, metric, S3 key hay fixture.
- [ ] Query trên dữ liệu tenant có lọc theo tenant.
- [ ] Các lời gọi ra bên ngoài mới chỉ tới các host đã cấu hình.

## 5. Tôn trọng ranh giới

- [ ] Code làm theo pattern có sẵn của module (truy cập dữ liệu, validate, xử lý lỗi, logging).
- [ ] Không thêm dependency mới khi không có lý do. Kiểm tra license, tình trạng bảo trì và `npm audit`.
- [ ] Tôn trọng phân tầng: controller không query database trực tiếp, adapter không chứa business rule.
- [ ] Contract của public API, webhook và event không đổi, hoặc có version.

## 6. Database và migration

- [ ] Mục migration review đã được điền (câu lệnh, algorithm/lock, rủi ro metadata lock, cách rollout).
- [ ] Không có `synchronize: true` ở đâu cả, trừ phần setup test dùng xong bỏ.
- [ ] Migration tương thích ngược với phiên bản đang chạy.
- [ ] Có `down()`, hoặc PR giải thích vì sao không có và cách khôi phục.
- [ ] Backfill chạy theo lô, chạy tiếp được khi bị ngắt, và tách riêng khỏi thay đổi schema.
- [ ] Thay đổi trên bảng lớn đã được thống nhất với người chạy release.

## 7. Tích hợp marketplace

- [ ] Handler có idempotency (dedupe key với unique constraint).
- [ ] Chỉ retry lỗi tạm thời, có backoff và số lần tối đa.
- [ ] Tôn trọng rate limit theo từng shop/account, trên tất cả ECS task.
- [ ] Item lỗi được đưa vào dead-letter queue hoặc bảng lỗi.
- [ ] Việc đối soát (reconciliation) vẫn bao phủ luồng vừa thay đổi.

## 8. Hạ tầng (nếu có đụng tới)

- [ ] IAM least privilege với tài nguyên cụ thể.
- [ ] Secret được inject qua ECS `secrets`.
- [ ] Cấu hình S3, RDS và CloudWatch tuân theo AWS rule.
- [ ] AI không thực hiện deploy hay apply nào.

## 9. Tài liệu đã cập nhật

- [ ] README, OpenAPI, runbook, ADR hoặc CLAUDE.md đã được cập nhật khi behaviour, lệnh hoặc kiến trúc thay đổi.
- [ ] File plan phản ánh đúng những gì thực sự đã làm.

## 10. AI review được xử lý trung thực

- [ ] Có tóm tắt AI review. Finding CRITICAL/HIGH đã được sửa hoặc trả lời kèm lý do.
- [ ] Finding bị bác bỏ có lý do cụ thể, không chỉ ghi "false positive".
- [ ] Tác giả đã tick ô "I have read and understood every line". Nếu nghi ngờ điều đó không đúng, hãy hỏi về những dòng cụ thể.

## Kết quả

- **Approve:** mọi mục áp dụng đều đạt.
- **Request changes:** bất kỳ mục nào trong phần 2–7 không đạt.
- **Comment:** chỉ có câu hỏi.
