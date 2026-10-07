# 08. Kế hoạch áp dụng

## Mục đích

Cách đưa bộ tiêu chuẩn này vào team khoảng 10 developer, qua ba wave. Mỗi wave có tiêu chí bắt đầu và kết thúc, một buổi retrospective ngắn và các chỉ số đã thống nhất.

## Vai trò

| Vai trò | Trách nhiệm | Người phụ trách |
| --- | --- | --- |
| **Owner của bộ tiêu chuẩn** | Sở hữu tài liệu và template, quyết định thay đổi, phát hành version, chủ trì retrospective | Xem 03, Danh sách người phụ trách |
| **Security owner** | Phê duyệt công cụ và repository của khách hàng, xử lý sự cố | Xem 03, Danh sách người phụ trách |
| **Champion Wave 1** | Dẫn dắt pilot, thu thập chỉ số và phản hồi | Xem 03, Danh sách người phụ trách |
| **Champion Wave 2** | Hỗ trợ nhóm thứ hai, thu thập chỉ số và phản hồi | Xem 03, Danh sách người phụ trách |
| **Champion Wave 3** | Hỗ trợ phần còn lại của team | Xem 03, Danh sách người phụ trách |
| **Tech lead** | Duyệt repository pilot, quyết định khi có xung đột quy trình | Xem 03, Danh sách người phụ trách |

## Chỉ số

Đo cho từng wave và so với mức nền (baseline) trong 4 tuần trước Wave 1 trên cùng các repository.

| Chỉ số | Định nghĩa | Nguồn |
| --- | --- | --- |
| **Lead time** | Ticket chuyển sang "In progress" → PR được merge | Backlog + GitHub |
| **Lỗi sau merge** | Bug truy được về một PR đã merge trong vòng 30 ngày, tính trên 10 PR | Backlog (ticket bug gắn với PR) |
| **Thời gian review** | PR mở → lần review đầu tiên của người; và PR mở → được approve | GitHub |
| **Độ đầy đủ bằng chứng** | % PR điền đúng và đủ mọi phần bằng chứng bắt buộc | Wave champion kiểm tra mọi PR |
| Phụ: làm lại | Số vòng review mỗi PR | GitHub |
| Phụ: phản hồi của developer | Điểm 1–5 và nhận xét ở mỗi buổi retro | Khảo sát ngắn |
| Phụ: chi phí AI | Chi phí mỗi developer mỗi tuần | Dashboard tài khoản |

Mục tiêu được đặt vào cuối Wave 1, dựa trên số liệu của wave đó, không đặt trước.

## Wave 1: pilot (2–3 tuần)

**Phạm vi:** 2 người áp dụng sớm, 1 repository nội bộ (không phục vụ khách hàng).

**Tiêu chí bắt đầu:**

- [ ] Đã chọn repository pilot và được tech lead duyệt.
- [ ] Đã thu thập chỉ số baseline.
- [ ] Repository đã cài bộ tiêu chuẩn bằng `scripts/adopt.mjs --profile standard` (00-quickstart): đã điền các mục `TODO(adopt)`, đã đặt lệnh trong `.claude/project.json`, `compose-settings.mjs --check` pass.
- [ ] Claude Code có trong bảng công cụ được phê duyệt với trạng thái "Under evaluation (Đang đánh giá)", ghi rõ repository pilot.
- [ ] Cả hai người áp dụng sớm đã đọc tài liệu 01–05 và có một buổi walkthrough 1 tiếng với owner của bộ tiêu chuẩn.

**Hoạt động:**

- Dùng toàn bộ quy trình (02) cho mọi ticket trong repository pilot.
- Check-in hằng tuần 30 phút: vấn đề gặp phải, rule chưa rõ, finding sai, lệnh còn thiếu.
- Ghi mọi thay đổi cần cho rule hoặc template vào danh sách phản hồi.
- Đánh giá sandbox của Claude Code trên repository pilot như một lớp kiểm soát bổ sung ở mức hệ điều hành (05). Ghi kết quả để đưa vào retrospective của Wave 1.
- Thử workflow docs-check và các phần tài liệu được sinh tự động (09) trên repository pilot.

**Tiêu chí kết thúc:**

- [ ] Hoàn thành ít nhất 10 PR theo toàn bộ quy trình.
- [ ] Độ đầy đủ bằng chứng ≥ 80%.
- [ ] Không có sự cố bảo mật, hoặc mọi sự cố đã được xử lý và khắc phục.
- [ ] Đã so sánh chỉ số với baseline và chia sẻ kết quả.
- [ ] Đã tổ chức retrospective; các thay đổi được phát hành thành version mới của bộ tiêu chuẩn.
- [ ] Đã ghi lại quyết định: tiếp tục, điều chỉnh hoặc dừng.

## Wave 2: nửa team (3–4 tuần)

**Phạm vi:** khoảng 5 developer, 2–3 repository, bao gồm **một repository của khách hàng chỉ khi** security owner duyệt việc dùng AI cho repository đó (đã ghi nhận quan điểm của khách hàng, dùng profile strict).

**Tiêu chí bắt đầu:**

- [ ] Đạt tiêu chí kết thúc của Wave 1.
- [ ] Đã tổ chức buổi đào tạo cho người mới tham gia (xem phần Đào tạo).
- [ ] Với repository của khách hàng: có quan điểm bằng văn bản của khách hàng, profile strict, phê duyệt của security owner, project lead đã được thông báo.
- [ ] Team lead và security owner đã rà soát trạng thái công cụ (vẫn đang đánh giá, hoặc được duyệt cho loại dữ liệu đã liệt kê).

**Hoạt động:**

- Dùng toàn bộ quy trình cho mọi ticket trong các repository đã chọn.
- Champion pair với từng người mới trong PR đầu tiên của họ.
- Thu thập phản hồi hằng tuần; họp đồng bộ 30 phút mỗi hai tuần.

**Tiêu chí kết thúc:**

- [ ] Ít nhất 25 PR trên các repository đã chọn.
- [ ] Độ đầy đủ bằng chứng ≥ 85%.
- [ ] Lỗi sau merge không cao hơn baseline.
- [ ] Thời gian review không tệ hơn baseline quá 20%.
- [ ] Không có sự cố chưa được xử lý; repository của khách hàng chỉ được dùng trong phạm vi đã duyệt.
- [ ] Đã tổ chức retrospective; phát hành version mới của bộ tiêu chuẩn.
- [ ] Đã ghi quyết định chính thức về trạng thái công cụ (approved / restricted / not approved) vào tài liệu 01.

## Wave 3: toàn team

**Phạm vi:** tất cả developer và mọi repository được phép dùng AI.

**Tiêu chí bắt đầu:**

- [ ] Đạt tiêu chí kết thúc của Wave 2.
- [ ] Công cụ đã được duyệt chính thức (hoặc giới hạn) trong tài liệu 01.
- [ ] Mọi repository đã được phân loại: nội bộ (profile standard) hoặc khách hàng (profile strict, hoặc không dùng AI).
- [ ] Các buổi đào tạo sẵn sàng cho tất cả mọi người.

**Hoạt động:**

- Cài bộ tiêu chuẩn vào từng repository được phép bằng `scripts/adopt.mjs` (khoảng 30 phút mỗi repository). Mỗi repository một PR, review như code.
- Từ đó trở đi, các repository nhận version mới qua các PR cập nhật được mô tả trong tài liệu 10.
- Các champion sẵn sàng trả lời câu hỏi; họp đồng bộ hằng tháng.

**Tiêu chí kết thúc (cuối quý đầu tiên):**

- [ ] Độ đầy đủ bằng chứng ≥ 90% trên các PR có AI hỗ trợ.
- [ ] Báo cáo chỉ số hằng tháng.
- [ ] Bộ tiêu chuẩn đi vào chu kỳ rà soát định kỳ (bên dưới).

## Đào tạo

| Buổi | Thời lượng | Đối tượng | Nội dung |
| --- | --- | --- | --- |
| 1. Chính sách và bảo mật | 60 phút | Mọi người, trước lần dùng đầu tiên | Tài liệu 01, 05: phân loại dữ liệu, những gì không bao giờ đưa cho AI, permission profile, sự cố |
| 2. Thực hành quy trình | 90 phút | Mỗi wave | Tài liệu 02 trên một ticket thật: plan, test fail trước, verify, review với context mới, bằng chứng trong PR |
| 3. Review PR có AI hỗ trợ | 45 phút | Tất cả reviewer | Tài liệu 04, kèm ví dụ về test yếu và finding quá tự tin |
| 4. Context và chi phí | 30 phút | Mỗi wave | Tài liệu 07: giữ session gọn gàng, cái gì đặt ở đâu |
| 5. LLM trong sản phẩm | 45 phút | Khi có feature cần đến | Tài liệu 06 |

Tài liệu và bản ghi hình được lưu cùng bộ tiêu chuẩn.

## Vòng phản hồi

- **Kênh:** một kênh chat riêng của team và một danh sách phản hồi do owner của bộ tiêu chuẩn quản lý.
- **Mỗi wave:** check-in hằng tuần và một buổi retrospective 45 phút ở cuối wave ("giữ / đổi / bỏ", xem lại chỉ số, sự cố).
- **Thay đổi:** đề xuất dưới dạng PR vào repository của bộ tiêu chuẩn, được owner của bộ tiêu chuẩn và một developer khác review. Thay đổi liên quan đến bảo mật cần thêm security owner.

## Chu kỳ rà soát và đánh version

- Cách đánh version, phát hành và cách các repository cập nhật được quy định trong 10-versioning-and-distribution.
- Trong các wave: phát hành sau mỗi buổi retrospective.
- Sau Wave 3: rà soát toàn bộ tài liệu hằng quý, và rà soát ngay sau mọi sự cố bảo mật hoặc thay đổi lớn về công cụ.
