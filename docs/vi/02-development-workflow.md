# 02. Quy trình phát triển

## Mục đích

Đây là cách team đưa một thay đổi vào code khi có AI hỗ trợ. Mỗi bước tạo ra bằng chứng (evidence) được đưa vào PR, để reviewer kiểm tra được công việc thay vì phải tin.

## Tổng quan

```text
Ticket → Plan → Failing test → Implement → Verify → Fresh-context review → PR → Human review → Merge
          ▲ human approves                                     human fixes / answers   ▲ human merges
```

| Bước | Ai dẫn dắt | AI hỗ trợ | Đầu ra |
| --- | --- | --- | --- |
| 1. Hiểu ticket | Developer | Tóm tắt, liệt kê câu hỏi | Acceptance criteria rõ ràng trên Backlog |
| 2. Plan | Developer | Skill `plan`, subagent `planner` | File plan đã được duyệt |
| 3. Test fail trước | Developer + AI | Skill `tdd-workflow` | Test fail đúng lý do |
| 4. Implement | Developer + AI | Skill `tdd-workflow` | Thay đổi tối thiểu, test pass |
| 5. Verify | AI chạy, developer kiểm tra | Skill `verification` | Báo cáo READY kèm output thật |
| 6. Review với context mới | AI reviewer, developer quyết định | `code-review`, `security-review`, `db-migration-review` | Finding, bản sửa hoặc câu trả lời |
| 7. PR | Developer | Viết nháp mô tả | PR có đủ các mục bằng chứng |
| 8. Review của con người | Reviewer | Tuỳ chọn | Approve hoặc yêu cầu sửa |
| 9. Merge | Developer / lead | Không | PR đã merge |

## Chi tiết từng bước

### 1. Hiểu ticket

- Ticket trên Backlog phải có acceptance criteria trước khi bắt đầu. Nếu chưa có, developer hỏi người tạo ticket.
- Tạo branch `<type>/<PROJ-123>-<slug>`.

### 2. Plan

- **Bắt buộc khi** thay đổi đụng tới hơn 2 file, một schema, một public API hoặc event, hoặc một marketplace adapter.
- **Tuỳ chọn** với các bản sửa nhỏ. Ghi "plan not needed: <lý do>" trong PR.
- Dùng plan mode của Claude Code hoặc skill `plan`. Plan phải:
  - chỉ ra code có sẵn cần làm theo,
  - liệt kê file và task, mỗi task kèm một lệnh chứng minh nó chạy đúng,
  - nêu ảnh hưởng tới database và API bên ngoài,
  - ghi rõ có đụng tới dữ liệu cá nhân hoặc dữ liệu khách hàng hay không.
- Developer đọc và duyệt plan một cách rõ ràng. Chưa duyệt thì chưa sửa code.
- Plan được lưu ở `docs/plans/<PROJ-123>-<slug>.md`, trừ khi CLAUDE.md của repository quy định khác.

### 3. Test fail trước

- Viết test trước. Chạy nó. Xác nhận test fail vì thiếu behaviour, chứ không phải vì gõ sai hay lỗi import.
- Ghi lại lệnh đã chạy và các dòng báo fail.

### 4. Implement

- Thực hiện thay đổi nhỏ nhất để test pass. Chạy lại đúng test đó, sau đó chạy cả bộ test của module.
- Làm theo pattern có sẵn trong repository. Refactor lớn hoặc không liên quan thì tách sang PR riêng.

### 5. Verify

- Chạy skill `verification`: build, typecheck, lint, unit test, integration test (nếu thay đổi phần truy cập dữ liệu), kiểm tra migration (nếu có), kiểm tra diff.
- Kết quả phải là **READY**. Mọi kết quả trong báo cáo phải đến từ lần chạy thật trong session này.

### 6. Review với context mới

- Chạy skill `code-review`. Reviewer là một subagent riêng, chỉ thấy diff, các file thay đổi và plan, không thấy cuộc hội thoại đã viết ra code. Nhờ vậy reviewer không bị cuốn theo lập luận của người viết.
- Thêm `security-review` khi đụng tới auth, credential, webhook, outbound HTTP, S3/file, IAM/infra hoặc dữ liệu cá nhân.
- Thêm `db-migration-review` khi có migration hoặc thay đổi entity.
- Finding mức CRITICAL và HIGH được kiểm tra lại lần thứ hai một cách độc lập. Sau đó developer sửa từng finding đã được xác nhận, hoặc ghi rõ vì sao nó không phải là vấn đề.
- Sau khi sửa, chạy lại verification.

### 7. Mở PR

- Dùng PR template. Điền đủ mọi mục bằng chứng. Chỉ xoá những mục không áp dụng, và nói rõ lý do.
- Ở repository khách hàng dùng profile strict, developer tự tạo commit và push. AI chỉ đề xuất commit message.

### 8. Review của con người

- Ít nhất một reviewer là người approve, dựa theo 04-pr-review-checklist.
- CI phải xanh: lint, typecheck, test, commitlint, secret scan.

### 9. Merge

- Developer hoặc lead merge sau khi có approve và CI xanh. Squash merge giữ lại bằng chứng trong mô tả PR.

## Definition of Done

Một thay đổi được coi là xong khi tất cả các điều sau đều đúng:

- [ ] Đáp ứng acceptance criteria trên ticket Backlog.
- [ ] Plan đã được duyệt (hoặc "not needed" kèm lý do).
- [ ] Mỗi thay đổi behaviour đều có test fail trước và pass sau.
- [ ] Báo cáo verification là READY.
- [ ] Đã review với context mới; mọi finding CRITICAL/HIGH đã được sửa hoặc trả lời.
- [ ] Đã làm security review và migration review khi bị kích hoạt.
- [ ] Đã cập nhật tài liệu, OpenAPI và runbook nếu behaviour thay đổi.
- [ ] CI xanh.
- [ ] Có ít nhất một approve của con người.
- [ ] Không có secret, dữ liệu cá nhân hay dữ liệu production ở bất kỳ đâu trong thay đổi hoặc trong PR.

## Chuỗi bằng chứng

Mô tả của mỗi PR gồm:

| Bằng chứng | Lấy từ đâu | Bắt buộc khi |
| --- | --- | --- |
| Link plan hoặc "not needed: lý do" | Skill `plan` | Luôn luôn |
| Test fail (lệnh + các dòng chính) | `tdd-workflow` | Thay đổi behaviour |
| Test pass (cùng lệnh) | `tdd-workflow` | Thay đổi behaviour |
| Bảng verification | `verification` | Luôn luôn |
| Tóm tắt AI review (tìm thấy / xác nhận / đã sửa / đã trả lời) | `code-review` | Khi có dùng AI |
| Security review | `security-review` | Các vùng kích hoạt |
| Migration review | `db-migration-review` | Có migration |

Bằng chứng phải là output thật. Reviewer có thể yêu cầu chạy lại bất kỳ lệnh nào. Bịa bằng chứng bị coi là vi phạm quy trình nghiêm trọng.

## Giữ session gọn gàng trong quy trình

- Mỗi session một ticket nếu có thể. Dùng `/clear` giữa các task không liên quan.
- Lưu file plan trước khi `/compact`.
- Xem chi tiết ở 07-context-and-cost.
