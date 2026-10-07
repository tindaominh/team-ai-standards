# 07. Context và chi phí

## Mục đích

Mọi thứ AI load vào context đều tốn tiền và tốn sự chú ý. Context nhỏ, tập trung cho câu trả lời tốt hơn và chi phí thấp hơn. Tài liệu này nói rõ mỗi loại chỉ dẫn nên đặt ở đâu và cách làm việc với session cho hiệu quả.

## Cái gì đặt ở đâu

| Vị trí | Khi nào được load | Nên đặt ở đây | Không đặt ở đây |
| --- | --- | --- | --- |
| `CLAUDE.md` (gốc repository) | Mọi session | Service làm gì, cấu trúc thư mục, lệnh chính xác, kiến trúc trong vài dòng, rule bắt buộc riêng của repository, link | Giải thích dài, tutorial, những gì đã có trong rule hoặc skill |
| `.claude/rules/std/common/*.md`, `.claude/rules/local/*.md` | Mọi session | Rule ngắn, kiểm tra được: của team (standard) và của riêng repository này (local) | Quy trình và ví dụ (đặt trong skill) |
| `.claude/rules/std/typescript/*.md`, `.claude/rules/std/fragments/*.md` | Khi đọc hoặc sửa file khớp (`paths:`) | Rule cho một loại file, cho từng framework, database và thư viện data access đã chọn, và cho hạ tầng AWS | Rule chung |
| `.claude/skills/std-<name>/SKILL.md` (+ các file fragment như `framework-nestjs.md`) | Mô tả luôn được load; nội dung và file fragment chỉ khi dùng | Quy trình từng bước kèm format output và ví dụ code | Rule phải luôn áp dụng |
| `.claude/agents/std-*.md` | Mô tả luôn được load; nội dung chỉ trong subagent | Vai trò cần context mới và tool giới hạn | Những gì session chính cần |
| `docs/` (bộ tiêu chuẩn này, ADR, runbook) | Chỉ khi có người bảo AI đọc | Giải thích cho người đọc | Chỉ dẫn AI phải luôn tuân theo |

Hiện tại `common/marketplace-integration.md` luôn được load, vì phần lớn công việc của team đụng tới adapter của các kênh bán. Nếu sau pilot ngân sách context bị căng, có thể giới hạn rule này theo đường dẫn tới các thư mục tích hợp (ví dụ `src/channels/**`, `src/orders/**`, `src/stock/**`).

## Giới hạn kích thước

| Mục | Giới hạn |
| --- | --- |
| Luôn được load: CLAUDE.md + rule không có `paths:` + mô tả của skill và agent | 2.300 từ (khoảng 3.000 token) |
| Trường hợp xấu nhất: phần luôn được load + mọi rule giới hạn theo đường dẫn (TypeScript, AWS) | 2.300 từ |
| Riêng CLAUDE.md | 150 dòng |
| Một file rule | 60 dòng |
| Một skill | 150 dòng |
| Một agent | 120 dòng |
| Mô tả của agent hoặc skill | 40 từ |
| Số skill mỗi repository | 6 skill của team + tối đa 2 skill riêng của repository |

Trong repository của bộ tiêu chuẩn, `npm run check:budget` đo bộ template và báo lỗi khi vượt một trong hai giới hạn; CI chạy lệnh này ở mọi thay đổi. Lệnh kiểm tra mọi tổ hợp hợp lệ của các stack fragment và giới hạn 150 từ của từng fragment. Bộ template 0.3.0 đo được khoảng 1.640 từ luôn được load; tổ hợp lớn nhất (Express + MySQL + PostgreSQL + TypeORM + AWS) khoảng 2.150 từ. Rule local trong `.claude/rules/local/` cộng thêm vào phần luôn được load; hãy giữ chúng ngắn. Rule chỉ chứa những câu ngắn, kiểm tra được; ví dụ code đặt trong skill, vì skill chỉ được load khi dùng tới. Trong repository dự án, đo bằng `wc -w CLAUDE.md .claude/rules/*/*.md` rồi nhân khoảng 1,3 để ra số token.

## Viết chỉ dẫn cho tốt

- Mỗi dòng một chỉ dẫn, viết thành điều kiểm tra được ("mọi query lấy danh sách đều có giới hạn"), không viết thành mong muốn chung chung ("viết query hiệu quả").
- Không lặp lại giữa CLAUDE.md, rule và skill. Nếu hai chỗ nói cùng một điều, xoá một chỗ.
- Ưu tiên để máy ép: nếu ESLint, TypeScript, commitlint hoặc CI kiểm tra được, hãy cấu hình công cụ thay vì viết rule.
- Xoá những rule team không còn cần. Rà soát ở mỗi lần release bộ tiêu chuẩn.

## Giữ session gọn gàng

- **Mỗi session một task.** Mở session mới hoặc `/clear` khi chuyển ticket.
- **Plan file trước.** Với việc dài, giữ plan trong file. File vẫn còn sau `/clear` và `/compact`.
- **Compact ở điểm chuyển giai đoạn.** Dùng `/compact` sau khi lập plan, sau một đợt tìm hiểu lớn, hoặc sau khi xong một task, không bao giờ giữa lúc đang sửa. Ghi các việc còn dở vào plan file trước.
- **Giao việc tìm kiếm rộng.** Dùng subagent để khám phá code trên diện rộng, để session chính chỉ nhận kết luận.
- **Chỉ đường, đừng paste.** Đưa đường dẫn file và số dòng thay vì paste cả file lớn hay log dài.
- **Log ngắn.** Khi chia sẻ output test hoặc build, chỉ đưa phần lỗi, không đưa hàng nghìn dòng.
- **Dừng vòng lặp sớm.** Nếu AI thử cùng một cách sửa hai lần mà không tiến triển, dừng lại, tự đọc lại lỗi và đưa ra hướng mới.

## Chọn model

| Công việc | Tầng model |
| --- | --- |
| Lập plan và câu hỏi kiến trúc, debug khó | Model mạnh nhất (agent `std-planner` dùng loại này) |
| Implement hằng ngày, test, review | Model cân bằng (mặc định; reviewer dùng loại này) |
| Sửa đơn giản, lặp lại, tóm tắt | Model nhỏ nhất, nếu có và đã được duyệt |

Chỉ đổi model khi kết quả chưa đủ tốt. Model lớn hơn không thay thế được một task rõ ràng và một plan tốt.

## Ý thức về chi phí

- Context lớn, đọc lại toàn bộ file nhiều lần và session dài là những thứ đẩy chi phí lên. Giữ session gọn gàng là đòn bẩy chính.
- Phần mở rộng thêm nhiều skill, agent hoặc rule làm tăng chi phí của mọi session. Tính điều này vào khi đánh giá (05).
- Các wave champion báo cáo mức sử dụng và chi phí theo từng developer trong giai đoạn pilot (xem 08). Ta dùng số liệu để đưa ra hướng dẫn, không để đổ lỗi cho cá nhân.
- Lịch sử session ở local được giữ 14 ngày (`cleanupPeriodDays` trong settings của team), để hạn chế thời gian code của khách hàng nằm trên đĩa.
