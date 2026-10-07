# 03. Vai trò và trách nhiệm

## Mục đích

Tài liệu này xác định ai chịu trách nhiệm phần nào khi công cụ AI tham gia vào công việc, và ai duyệt từng quyết định.

## Vai trò

| Vai trò | Ai | Chịu trách nhiệm |
|---|---|---|
| **Developer (tác giả)** | Người được giao ticket | Thay đổi từ lúc plan đến lúc merge, kể cả từng dòng do AI viết |
| **Reviewer** | Một developer khác (hoặc lead) | Đánh giá độc lập về tính đúng đắn, an toàn và mức độ phù hợp |
| **Trợ lý AI** | Claude Code (và các subagent đã duyệt) | Các đề xuất: plan, test, code, finding khi review. Không có gì AI làm ra là bản cuối nếu chưa qua con người |
| **Tech lead** | Team lead | Quyết định kiến trúc, ngoại lệ, quyền merge vào branch được bảo vệ |
| **Security owner** | Người được chỉ định (xem README) | Duyệt công cụ AI, giải đáp về phân loại dữ liệu, xử lý sự cố |
| **Owner của bộ tiêu chuẩn** | Người được chỉ định (xem 08) | Bộ tiêu chuẩn này, các phiên bản, template và kế hoạch triển khai |
| **Wave champion** | Mỗi đợt triển khai một người (xem 08) | Hỗ trợ đồng nghiệp, thu thập feedback và số liệu trong một đợt |
| **Project lead (dự án khách hàng)** | Theo từng khách hàng | Ghi lại quan điểm của khách hàng về AI và các giới hạn của repository |

## Ma trận trách nhiệm

R = người làm, A = người chịu trách nhiệm / duyệt, C = được hỏi ý kiến, I = được thông báo.

| Hoạt động | Developer | AI | Reviewer | Tech lead | Security owner |
|---|---|---|---|---|---|
| Làm rõ ticket và acceptance criteria | R/A | C | | C | |
| Viết plan | R/A | R | | C (thay đổi lớn) | C (dữ liệu nhạy cảm) |
| Duyệt plan | A | | | A (thay đổi kiến trúc) | |
| Viết test và code | R/A | R | | | |
| Chạy verification | A | R | | | |
| AI review với context mới | A | R | I | | |
| Quyết định về finding của AI (sửa hoặc trả lời) | R/A | C | I | | |
| Commit và push | R/A | (strict: không; standard: đề xuất) | | | |
| Mở PR kèm bằng chứng | R/A | C | I | | |
| Review và approve của con người | | | R/A | C | C (liên quan bảo mật) |
| Merge | R | | | A (branch được bảo vệ) | |
| Deploy | Theo quy trình release, không bao giờ là AI | | | A | |
| Duyệt công cụ AI, plugin, MCP server hoặc hook mới | | | | A | A |
| Báo cáo sự cố dữ liệu liên quan tới AI | R | | | I | A |
| Thay đổi bộ tiêu chuẩn này | C | | C | C | C |

Owner của bộ tiêu chuẩn chịu trách nhiệm (A) cho dòng cuối cùng.

## Những gì AI được và không được làm

Được:

- Đọc repository (trừ file secret và file dump), tìm kiếm code và chạy các lệnh chỉ đọc, build, lint, test đã được cho phép.
- Đề xuất plan, test, thay đổi code, commit message và mô tả PR.
- Sửa file trong working copy khi developer yêu cầu.
- Chạy subagent để lập plan và review.

Không được:

- Đọc secret, file `.env*`, credential hoặc dữ liệu production.
- Push, merge, rebase branch dùng chung, force-push hoặc reset hard.
- Commit ở repository khách hàng (profile strict). Ở repository nội bộ, chỉ commit khi developer xác nhận.
- Deploy, hoặc tạo, sửa, xoá tài nguyên cloud.
- Cài package, plugin, MCP server hoặc hook khi chưa được developer đồng ý.
- Tự approve công việc của chính nó hoặc PR của bất kỳ ai.

## Trách nhiệm của reviewer với PR có AI hỗ trợ

- Review code, không chỉ nhìn bằng chứng. Bằng chứng cho biết đã chạy gì; nó không chứng minh logic là đúng.
- Kiểm tra test có ý nghĩa: test có fail nếu behaviour bị hỏng không?
- Kiểm tra các finding của AI review đã được xử lý một cách trung thực.
- Dùng 04-pr-review-checklist.

## Escalation

- Bất đồng về một finding: tác giả và reviewer trao đổi; tech lead quyết định nếu cần.
- Nghi ngờ lộ dữ liệu: dừng lại, báo security owner ngay trong ngày (xem 05).
- Vướng mắc về quy trình trong bộ tiêu chuẩn: báo với wave champion hoặc owner của bộ tiêu chuẩn.
