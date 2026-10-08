# 01. Chính sách sử dụng AI

## Mục đích

Chính sách này quy định những công cụ AI nào được dùng, dữ liệu nào được đưa vào, và ai chịu trách nhiệm về kết quả. Chính sách áp dụng cho mọi developer, mọi repository mà team làm việc (nội bộ và của khách hàng), và mọi công cụ AI dùng trong công việc phát triển.

## Công cụ được phê duyệt

Chỉ những công cụ có trong bảng này mới được dùng cho công việc của công ty hoặc của khách hàng. Trạng thái của một công cụ chỉ thay đổi sau khi team lead và security owner phê duyệt chính thức. Việc phê duyệt được ghi lại tại đây, kèm tên người duyệt và ngày duyệt.

| Công cụ | Trạng thái | Người duyệt | Ngày | Dữ liệu được phép | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Under evaluation (Đang đánh giá) | | | Repository nội bộ trong Wave 1 (xem 08) | Trạng thái chỉ thay đổi sau khi team lead / security owner phê duyệt chính thức. |
| `<tool>` | `<status>` | | | | |

Các giá trị trạng thái:

- **Under evaluation (Đang đánh giá):** chỉ dùng thử nghiệm, trong các repository được nêu trong kế hoạch triển khai.
- **Approved (Đã phê duyệt):** được dùng trong phạm vi cột "Dữ liệu được phép".
- **Restricted (Hạn chế):** chỉ được duyệt cho một số repository (ghi ở cột Ghi chú).
- **Not allowed (Không được phép).**

Quy tắc:

- Chỉ dùng tài khoản hoặc license do công ty cấp cho các công cụ đã duyệt. Không dùng tài khoản cá nhân cho công việc của công ty hay của khách hàng.
- Chỉ cài extension, plugin, skill, hook hoặc MCP server AI nếu chúng có trong danh sách đã duyệt hoặc đã được review theo 05-security-guidelines.
- Nếu hợp đồng với khách hàng giới hạn việc dùng AI, quy định của khách hàng được ưu tiên. Xem mục "Giới hạn riêng theo khách hàng".

## Phân loại dữ liệu

| Loại | Ví dụ | Có được gửi vào công cụ AI đã duyệt không? |
| --- | --- | --- |
| **Public (Công khai)** | Code open-source, tài liệu công khai, tài liệu API công khai của marketplace | Có |
| **Internal (Nội bộ)** | Code service nội bộ của team, tài liệu nội bộ, dữ liệu test giả lập | Có, với công cụ đã duyệt |
| **Client confidential (Mật của khách hàng)** | Source code của khách hàng, kiến trúc hệ thống của khách hàng, business rule của khách hàng | Chỉ khi khách hàng cho phép bằng văn bản và repository nằm trong danh sách được phép. Nếu không thì không. |
| **Personal data (Dữ liệu cá nhân)** | Tên, số điện thoại, email, địa chỉ khách hàng, nội dung đơn hàng gắn với một người cụ thể | **Không bao giờ** |
| **Secrets** | Mật khẩu, API key, token, private key, AWS credential, file `.env`, connection string | **Không bao giờ** |
| **Production data (Dữ liệu production)** | Bản dump database, log production, dữ liệu export từ S3, ticket hỗ trợ có dữ liệu khách hàng | **Không bao giờ** |

Quy tắc thực tế:

- Không bao giờ dán secret, dữ liệu cá nhân hay dữ liệu production vào prompt, vào ticket mà bạn nhờ AI đọc, hoặc vào file mà AI có thể đọc.
- Khi làm việc với AI, không để secret thật trong file `.env` nằm trong repository: các file này chỉ chứa giá trị local hoặc giả, còn secret thật được inject lúc chạy từ CLI của password manager hoặc một secret store tương tự. Test, script và config của tool mà AI chạy có thể đọc mọi file trong working copy (05, mục 3).
- Credential cloud trên máy bạn phải có thời hạn ngắn (SSO hoặc session assume role) hoặc được bảo vệ bằng MFA. Không có access key dài hạn trên máy developer.
- Dùng dữ liệu giả lập cho test, ví dụ và debug. Nếu cần tái hiện bug trên production, hãy dựng lại case đó bằng giá trị giả.
- Không đưa tên khách hàng, thuật ngữ nghiệp vụ riêng của khách hàng hay code vào các lượt tìm kiếm web thực hiện qua AI.
- Khi phát hiện công cụ AI đã nhìn thấy thứ không được phép, làm theo các bước xử lý sự cố trong 05-security-guidelines. Không được che giấu.

## Giới hạn riêng theo khách hàng

- File `CLAUDE.md` của mỗi repository khách hàng ghi rõ mã khách hàng và settings profile đang dùng (mặc định là strict).
- Project lead ghi lại quan điểm của khách hàng về AI trên trang nội bộ của dự án: được phép / được phép có điều kiện / không được phép, kèm nguồn (điều khoản hợp đồng hoặc xác nhận bằng văn bản) và ngày.
- Nếu chưa rõ quan điểm của khách hàng, coi như **không được phép** cho đến khi được xác nhận.
- Một số khách hàng yêu cầu công cụ cụ thể, region cụ thể, hoặc hoàn toàn không dùng AI. Những yêu cầu này được ưu tiên hơn chính sách này.

## Trách nhiệm của con người

- Developer mở PR chịu trách nhiệm về từng dòng trong đó, kể cả những dòng do AI viết. "AI viết đấy" không bao giờ là lời giải thích cho một lỗi.
- Gợi ý của AI chỉ là đề xuất. Con người quyết định commit gì, merge gì và deploy gì.
- AI không được approve PR, merge, push, deploy hay thay đổi tài nguyên cloud. Settings của repository bắt buộc điều này (xem 05).
- Reviewer áp dụng cùng một tiêu chuẩn cho code có AI hỗ trợ như với mọi code khác (xem 04-pr-review-checklist).

## Cùng một tiêu chuẩn chất lượng

Công việc có AI hỗ trợ phải đạt cùng Definition of Done như mọi công việc khác (xem 02-development-workflow): test, verification, review và tài liệu. Ra kết quả nhanh hơn không phải là lý do để bỏ qua bất kỳ bước nào.

## Ngoại lệ và câu hỏi

Hỏi owner của bộ tiêu chuẩn. Mọi ngoại lệ đều được ghi lại bằng văn bản, kèm lý do, người chịu trách nhiệm và ngày hết hạn.
