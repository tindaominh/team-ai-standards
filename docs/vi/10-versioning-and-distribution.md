# 10. Đánh version và phân phối bộ tiêu chuẩn

## Mục đích

Cách bộ tiêu chuẩn này được đánh version và phát hành, và cách các project repository áp dụng version mới mà không ai phải push thay đổi trực tiếp vào chúng.

## 1. Số version

Bộ tiêu chuẩn dùng semantic versioning: `MAJOR.MINOR.PATCH`. Version nằm ở ba nơi và phải khớp nhau: `package.json`, `templates/.claude/STANDARD_VERSION` và heading mới nhất trong `CHANGELOG.md`.

| Thay đổi | Mức | Ví dụ |
| --- | --- | --- |
| Developer hoặc repository phải làm khác đi, hoặc một thay đổi template có thể làm hỏng repository đã áp dụng | **MAJOR** | Thêm bước bắt buộc vào quy trình; chính sách dữ liệu chặt hơn; bỏ một quyền khỏi `allow`; đổi tên placeholder |
| Thêm mới hoặc chặt hơn nhưng không làm hỏng repository đã áp dụng | **MINOR** | Rule, skill, tài liệu hoặc workflow tuỳ chọn mới; deny rule mới; placeholder mới có giá trị mặc định an toàn |
| Câu chữ, lỗi chính tả, ví dụ, làm rõ mà không đổi ý nghĩa | **PATCH** | Sửa link hỏng; câu chữ tiếng Việt tốt hơn |

Khi major version còn là `0`, các bản minor có thể chứa thay đổi phá vỡ tương thích; những thay đổi đó được đánh dấu **Breaking** trong CHANGELOG.

## 2. Kỷ luật CHANGELOG

- Mỗi PR vào repository này thêm một dòng dưới `## [Unreleased]` trong `CHANGELOG.md`, thuộc một trong các nhóm: Added, Changed, Removed, Fixed, Security.
- Mỗi dòng nói rõ cái gì thay đổi và, nếu cần, các repository đã áp dụng phải làm gì (ví dụ "thay `<unit-test-cmd>` trong settings").
- Thay đổi phá vỡ tương thích bắt đầu bằng **Breaking:**.
- Khi phát hành, `[Unreleased]` được đổi thành `[x.y.z] - YYYY-MM-DD`.
- Tài liệu tiếng Anh và tiếng Việt thay đổi trong cùng một PR; CI kiểm tra cấu trúc của chúng khớp nhau.

## 3. Phát hành

1. Owner of the standard mở release PR: tăng version trong `package.json` và `templates/.claude/STANDARD_VERSION`, ghi ngày cho heading trong CHANGELOG.
2. CI (`standard-ci`) pass: lint, JSON, settings, parity, budget, smoke test.
3. Sau khi merge, owner tạo annotated tag trên `main`: `git tag -a v0.2.0 -m "Team AI standard 0.2.0"` rồi push tag đó.
4. Owner tạo GitHub release từ tag, dùng phần CHANGELOG tương ứng làm release notes.
5. Tag sẽ kích hoạt job cập nhật (mục tiếp theo).

Nhịp phát hành: sau mỗi buổi retrospective của từng wave trong giai đoạn triển khai, sau đó mỗi quý một lần, và phát hành ngay khi có bản sửa lỗi bảo mật.

## 4. Cách project repository ghi lại version

- Mỗi repository có file `.claude/STANDARD_VERSION` chứa version đang dùng (ví dụ `0.2.0`).
- `CLAUDE.md` tham chiếu tới file đó thay vì ghi lại con số.
- Pilot và các wave sau báo cáo mỗi repository đang ở version nào.

## 5. Pull request cập nhật

Workflow: `.github/workflows/standard-update.yml` trong repository này, đi kèm `scripts/sync-standard.mjs`. Danh sách repository đích nằm trong `.github/standard-targets.json`:

```json
{
  "targets": [
    { "repo": "<org>/<order-sync-service>", "profile": "standard", "baseBranch": "main" },
    { "repo": "<org>/<client-x-adapter>", "profile": "strict", "baseBranch": "develop", "enabled": false }
  ]
}
```

Khi một release tag được push, với mỗi repository đích đang bật, job sẽ:

1. Kiểm tra tag, `package.json` và `STANDARD_VERSION` khớp nhau.
2. Checkout repository đích.
3. Chạy `sync-standard.mjs`:
   - ghi đè các file do bộ tiêu chuẩn quản lý (rule của team, agent, skill của team, PR template);
   - chỉ cập nhật hook nếu repository đã dùng hook;
   - **thêm** các deny rule và ask rule còn thiếu vào `.claude/settings.json`, không bao giờ xoá rule và không bao giờ thay đổi `allow`;
   - ghi `.claude/STANDARD_VERSION`;
   - không bao giờ thay đổi `CLAUDE.md` hoặc các file riêng của repository.
4. Commit vào một branch mới `chore/ai-standard-v<version>` và mở **một pull request** trong repository đó. Job không bao giờ push vào base branch.
5. Mô tả PR liệt kê các file được cập nhật, các rule được thêm, và những gì owner phải tự review (thay đổi trong template CLAUDE.md, các settings rule chỉ có trong repository, các file không còn được phân phối).

Sau đó:

- Owner của repository review và merge PR như mọi thay đổi khác. Các check bắt buộc và CODEOWNERS vẫn áp dụng.
- Job đăng một thông báo lên chat của team, gồm version, link release notes và danh sách repository đích. Slack là mặc định (`SLACK_WEBHOOK_URL`); đặt `CHAT_PROVIDER=teams` để dùng Microsoft Teams (`TEAMS_WEBHOOK_URL`). Webhook URL chỉ lấy từ GitHub Secrets.

Quyền truy cập:

Job cần quyền ghi vào các repository khác. **Chọn loại credential nào là quyết định cuối cùng của security owner.**

| Phương án | Thiết lập | Lý do |
| --- | --- | --- |
| **Khuyến nghị: GitHub App** | App thuộc sở hữu của organisation, chỉ cài trên các repository đích, có quyền ghi Contents và Pull requests. Biến `STANDARD_APP_CLIENT_ID`, secret `STANDARD_APP_PRIVATE_KEY`. | Job tạo installation token ngắn hạn riêng cho từng repository đích. Không gắn với một người cụ thể, nên vẫn dùng được khi có người nghỉ việc. Mọi PR đều hiển thị là do App mở. |
| Phương án dự phòng: fine-grained personal access token | Token thuộc một tài khoản bot riêng, chỉ giới hạn trong các repository đích, quyền ghi Contents và Pull requests, có ngày hết hạn. Secret `STANDARD_UPDATE_TOKEN`. | Dễ thiết lập, nhưng tồn tại lâu, gắn với một tài khoản, và phải rotate trước khi hết hạn. |

Workflow dùng App khi `STANDARD_APP_CLIENT_ID` được đặt, ngược lại dùng token dự phòng. Không bao giờ dùng classic personal access token hoặc token của một người thật.

- Repository của khách hàng chỉ được thêm vào danh sách đích khi project lead đồng ý, và thường để `enabled: false` cho tới khi quan điểm về AI của khách hàng được xác nhận.

## 6. Áp dụng một version lần đầu

Repository mới không dùng job cập nhật cho lần cài đặt đầu tiên. Hãy làm theo mục "Cách áp dụng cho một repo" trong README, sau đó thêm repository vào `standard-targets.json` để nhận các bản cập nhật sau này.

## 7. Bỏ qua hoặc hoãn một bản cập nhật

- Owner của repository có thể hoãn một PR cập nhật (ví dụ trong thời gian release freeze), nhưng không quá bản minor tiếp theo.
- Các bản phát hành bảo mật phải được merge trong vòng 5 ngày làm việc.
- Nếu một repository không thể áp dụng một thay đổi, owner ghi lại ngoại lệ với owner of the standard (lý do, ngày kết thúc).
