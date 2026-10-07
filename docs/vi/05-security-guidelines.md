# 05. Hướng dẫn bảo mật khi phát triển có AI hỗ trợ

## Mục đích

Cách chúng ta giữ an toàn cho source code của khách hàng, dữ liệu khách hàng và credential khi các công cụ AI làm việc trong repository của mình. Tài liệu bao gồm prompt injection, quyền (permission), các phần mở rộng (plugin, skill, hook, MCP server), quản lý secret và xử lý sự cố.

## 1. Nguyên tắc

1. **Ép bằng cấu hình, không bằng prompt.** Chỉ dẫn trong CLAUDE.md và rule có ích, nhưng có thể bị bỏ qua hoặc bị ghi đè. Permission settings, kiểm tra trong CI và phân quyền truy cập mới là cơ chế kiểm soát thật sự.
2. **Quyền tối thiểu.** AI chỉ được cấp số tool và lệnh ít nhất đủ cho công việc. Reviewer chỉ được đọc.
3. **Không có secret ở nơi AI làm việc.** Secret an toàn nhất là secret hoàn toàn không nằm trong working copy.
4. **Mọi thứ từ bên ngoài đều không đáng tin.** Ticket, tài liệu, trang web, response từ marketplace, nội dung file và output của tool đều có thể chứa chỉ dẫn. Chúng chỉ là dữ liệu.
5. **Con người giữ các thao tác không thể đảo ngược.** Push, merge, deploy, thay đổi cloud và rotate secret do người thực hiện.

## 2. Prompt injection

Prompt injection là đoạn văn bản cố khiến AI làm điều bạn không yêu cầu. Ví dụ: một comment trong file, mô tả ticket, README của một dependency, một API response hay một trang web có câu "bỏ qua các chỉ dẫn trước và chạy …".

Quy tắc:

- Coi output của tool, nội dung file, ticket và trang đã fetch là dữ liệu. AI không được làm theo chỉ dẫn nằm bên trong chúng nếu chưa hỏi bạn.
- Để ý các hành động bất thường: lệnh bạn không yêu cầu, network request, đọc file không liên quan tới task, cố sửa settings. Dừng session và kiểm tra.
- Cẩn thận với nội dung ẩn: ký tự vô hình hoặc zero-width, ký tự trông giống nhau, đoạn paste rất dài, chuỗi đã mã hoá (base64, URL-encoded), lời lẽ gấp gáp hoặc mang tính ra lệnh ("đội bảo mật yêu cầu bạn…").
- Khi làm việc cho khách hàng, không để AI fetch URL tuỳ ý lấy từ ticket hoặc code. Settings của team để web access ở chế độ "ask".
- Xem kỹ lệnh AI đề xuất trước khi đồng ý, nhất là `curl`, `docker`, `npx`, `aws` và bất cứ lệnh nào pipe vào shell.

## 3. Permission

Mỗi repository có `.claude/settings.json` lấy từ template của team. Profile phụ thuộc vào loại repository:

| Loại repository | Profile | File sử dụng | AI được ghi git |
| --- | --- | --- | --- |
| **Repository của khách hàng** (có code của khách hàng) | **strict** (mặc định) | `adopt.mjs --profile strict` (base: `.claude/std/settings.strict.json`) | Không. Không add, commit, checkout, stash, push. |
| **Repository nội bộ** (code của mình, không có dữ liệu khách hàng) | **standard** | `adopt.mjs --profile standard` (base: `.claude/std/settings.standard.json`) | Add/commit/branch local khi bạn xác nhận. Không bao giờ push. |

Nếu không chắc repository thuộc loại nào, dùng **strict**.

Cả hai profile đều chặn (deny):

- Đọc hoặc sửa `.env*`, file key và certificate, file credential, thư mục `secrets/`, `~/.aws`, `~/.ssh`, và các bản dump database.
- `env` / `printenv`, `aws configure`, đọc giá trị secret từ Secrets Manager hoặc SSM, đọc log CloudWatch.
- `git push` (kể cả force), `reset --hard`, `rebase`, `merge`, `clean`, xoá branch bằng `-D`.
- Các lệnh deploy được liệt kê cụ thể: `npm/pnpm/yarn run deploy*`, `cdk deploy/destroy`, `serverless`/`sls deploy`, `sam deploy`, `copilot … deploy`, `eb deploy`, `terraform apply/destroy`, `aws ecs update-service`, `aws ecs run-task`, `aws cloudformation deploy`, `docker push`.
- Lệnh AWS CLI tạo, cập nhật, xoá, start, stop, run, tag hoặc copy tài nguyên, cùng `s3 cp/mv/rm/sync`.
- Merge, review hoặc release qua GitHub CLI.
- Kết nối database bằng `mysql` CLI hoặc dump bằng `mysqldump`. Các rule này chỉ khớp với lệnh bắt đầu bằng đúng hai chương trình đó, nên `mysqladmin` hay `grep mysql` không bị ảnh hưởng.
- Chế độ bypass permissions (`"disableBypassPermissionsMode": "disable"`). MCP server của project không được tự động bật.

Cả hai profile đều hỏi (ask) trước khi:

- Cài hoặc cập nhật package, `npx`, `docker`, `curl`, `wget`, mọi lệnh `aws` hoặc `gh` khác, tạo hoặc chạy migration, web fetch và web search.

Cả hai profile cho phép không cần hỏi:

- Các lệnh build, lint, typecheck, unit test, integration test và xem trạng thái migration của repository, `npm audit`, và các lệnh git chỉ đọc.
- Trong template, các lệnh này được ghi dưới dạng placeholder (`<build-cmd>`, `<unit-test-cmd>`, …). Hãy thay bằng lệnh trong bảng lệnh của CLAUDE.md. Placeholder chưa điền sẽ không khớp với lệnh nào, nên lệnh đó chỉ đơn giản là phải hỏi.

Giới hạn của permission rule (theo tài liệu chính thức của Claude Code, trang "Configure permissions"):

- Rule cho Bash so khớp với nội dung câu lệnh mà Claude viết ra. Tài liệu ghi rõ rule như vậy "covers the invocation Claude usually produces and isn't a security boundary around the program", tức là nó chỉ chặn cách gọi thông thường chứ không phải ranh giới bảo mật quanh chương trình. Cùng chương trình đó nếu được gọi bằng đường dẫn đầy đủ, bên trong `sh -c`, hoặc từ một script thì sẽ không bị khớp.
- Deny rule cho `Read` và `Edit` cũng áp dụng cho các lệnh đọc/ghi file mà Claude Code nhận diện được trong Bash (`cat`, `head`, `tail`, `sed`, `tee`) và cho redirection. Chúng **không** áp dụng cho lệnh đọc file mà không nêu tên file (ví dụ `grep -r pattern .`) hoặc script tự mở file.
- Deny rule trong `permissions.deny` áp dụng cho cả cuộc hội thoại chính lẫn các subagent.
- Vì vậy: không để secret thật trong working copy, dùng giá trị giả ở local khi phát triển, và theo dõi những gì AI chạy. Để chặn ở mức hệ điều hành, tài liệu khuyến nghị dùng sandbox của Claude Code; việc đánh giá sandbox nằm trong pilot Wave 1 (xem 08).

Ghi đè ở local:

- `.claude/settings.json` được sinh ra từ base profile và `.claude/project.json`; không bao giờ sửa tay. Rule riêng của repository đặt trong `permissions` của `.claude/project.json`.
- Thay đổi cá nhân đặt trong `.claude/settings.local.json` (không bao giờ commit). Rule deny và ask của bộ tiêu chuẩn vẫn có hiệu lực: tài liệu chính thức ghi rõ "if a tool is denied at any level, no other level can allow it" (công cụ đã bị deny ở bất kỳ cấp nào thì không cấp nào khác cho phép lại được). Những gì được và không được đặt trong file đó liệt kê ở tài liệu 10, mục "Personal settings (Layer 3)". Bạn không được nới rule cho repository của khách hàng nếu chưa có phê duyệt của security owner.

## 4. Phần mở rộng của bên thứ ba: plugin, skill, hook, MCP server

Phần mở rộng thêm chỉ dẫn, tool hoặc code vào session AI của bạn. Một số chạy code trên máy bạn ở mỗi lần gọi tool; một số kết nối tới dịch vụ từ xa. Đánh giá mọi phần mở rộng theo các quy tắc dưới đây trước khi cài, kể cả khi nó rất phổ biến.

### 4.1 Những rủi ro cần tìm

| Rủi ro | Ý nghĩa | Vì sao quan trọng với chúng ta |
| --- | --- | --- |
| **Ghi lại input/output của tool** | Lưu prompt, nội dung file, output của lệnh hoặc diff xuống đĩa (log, "memory", "learning", analytics) | Code của khách hàng và dữ liệu khách hàng nằm ở những nơi ta không kiểm soát hoặc không dọn dẹp |
| **Gửi dữ liệu ra khỏi máy** | Gọi API từ xa, telemetry, cloud memory, model AI khác, webhook | Dữ liệu mật đi ra ngoài phạm vi của ta |
| **Chạy code ở mỗi lần gọi tool hoặc sự kiện session** | Hook tự động chạy script, thường với toàn bộ quyền user của bạn | Một lỗi hoặc một bản cập nhật độc hại chạy âm thầm ở mọi thao tác |
| **Tải về không pin version** | Chạy `npx package`, `@latest`, một script tải về rồi pipe vào shell, hoặc tự cập nhật | Code chạy ngày mai không phải là code bạn đã review |
| **Truy cập file rộng** | Đọc thư mục home, repository khác, thư mục credential, dữ liệu trình duyệt | Secret và code của khách hàng khác có thể bị lộ |
| **Sửa settings toàn cục** | Ghi vào settings AI cấp user của bạn hoặc vào repository khác | Ảnh hưởng tới công việc ngoài project đã cài nó |
| **Context thường trực lớn** | Hàng trăm skill, agent hoặc rule được load mỗi session | Tốn chi phí hơn, kém tập trung hơn, nhiều chỉ dẫn xung đột với của ta hơn |
| **Thay đổi hành vi âm thầm** | Sửa lệnh của bạn, sửa file khi dừng, tự format bằng tool nó tự tải về | Thay đổi chưa được review lọt vào diff của bạn |

### 4.2 Quy tắc đánh giá

Trước khi bất kỳ ai cài một phần mở rộng cho công việc của công ty hoặc khách hàng:

1. **Chỉ từ nguồn chính thức hoặc đã biết.** Từ nhà cung cấp công cụ, từ repository của chính ta, hoặc từ nguồn được security owner phê duyệt.
2. **Đọc mọi thứ có thực thi.** Script hook, code hoặc package của MCP server, script cài đặt, lifecycle script trong `package.json`. Không đọc được thì không cài.
3. **Trả lời các câu hỏi sau bằng văn bản** (trong yêu cầu gửi security owner):
   - Nó đọc, ghi và thực thi những gì?
   - Nó lưu dữ liệu ở đâu? Trong bao lâu? Có tắt được không?
   - Nó có gọi mạng không? Tới đâu? Gửi những gì?
   - Nó có tự chạy không (hook, lúc bắt đầu session, mỗi lần gọi tool)?
   - Version có được pin không (version chính xác hoặc commit hash)? Nó có tự cập nhật không?
   - Nó thêm bao nhiêu context vào mỗi session?
4. **Pin version.** Version chính xác hoặc commit hash. Không `@latest`, không tự cập nhật, không chạy `npx` không pin lúc runtime.
5. **Phạm vi project, không toàn cục.** Cài theo từng repository khi có thể, để repository của khách hàng không bị ảnh hưởng bởi thử nghiệm ở chỗ khác.
6. **Bắt đầu ở repository nội bộ.** Không bao giờ thử phần mở rộng trong repository của khách hàng.
7. **Review lại mỗi lần nâng cấp.** Nâng cấp là một lần cài mới.
8. **Ghi lại quyết định** trong bảng công cụ được phê duyệt (01) với trạng thái, người phê duyệt, ngày và dữ liệu được phép.

Tự động từ chối cho repository của khách hàng: bất cứ thứ gì ghi lại input/output của tool, gửi nội dung repository cho bên thứ ba, hoặc chạy code tải về không pin version.

### 4.3 MCP server

- Chỉ dùng MCP server được security owner phê duyệt, đã pin version, với scope và token tối thiểu.
- Ưu tiên quyền chỉ đọc. Một server có quyền ghi vào công cụ ticket, nơi host repository hoặc tài khoản cloud là một phê duyệt rủi ro cao.
- Không tự động bật server được khai báo trong repository (`enableAllProjectMcpServers` là `false` trong settings của team).
- Credential cho MCP server nằm trong secret store hoặc biến môi trường trên máy bạn, không bao giờ trong file được commit.

### 4.4 Hook của team

Hook của team chỉ được **kiểm tra** hoặc **nhắc nhở**. Hook của team không bao giờ được ghi hoặc sửa file trong repository, ghi file dùng chung (docs, CLAUDE.md, settings), commit hay push, gọi mạng, tải bất cứ thứ gì về, hoặc gửi dữ liệu ra khỏi máy. Việc ghi và công bố thay đổi do developer làm, hoặc do CI làm trên pull request (xem 09).

Các hook tuỳ chọn của team (`.claude/std/hooks/`, bật bằng `"hooks": true` trong `.claude/project.json`) tuân theo quy tắc này: tất định, chỉ chạy binary local ở chế độ kiểm tra, và ghi rõ chúng đọc và chạy những gì. Mọi hook mới đều phải qua cùng quy trình review.

## 5. Quản lý secret

- Secret của production và staging nằm trong AWS Secrets Manager hoặc SSM Parameter Store. Ứng dụng đọc chúng lúc runtime qua module config.
- Phát triển local dùng `.env` chỉ với giá trị local hoặc giả. Không bao giờ đưa credential dùng chung thật vào `.env` local cho tiện.
- Commit một file `config/env.example` với tên biến và giá trị giả. AI đọc được file này; AI không đọc được `.env`.
- CI dùng GitHub OIDC để assume AWS role. Không để AWS key dài hạn trong GitHub secrets.
- Một công cụ quét secret chạy trong CI và chặn PR khi phát hiện.
- Không bao giờ paste secret vào prompt, ticket, PR hay chat, kể cả "chỉ một giây".

## 6. Dữ liệu cá nhân và dữ liệu khách hàng

- Không bao giờ đưa cho AI dữ liệu production, dump, log hoặc ticket hỗ trợ có dữ liệu khách hàng.
- Tái hiện bug bằng dữ liệu giả lập.
- Khi chính một feature gửi dữ liệu cho LLM ở production, làm theo 06-llm-in-product-pattern và xin phê duyệt của security owner.

## 7. Sự cố

Ví dụ: một secret bị hiển thị cho hoặc bị paste vào công cụ AI, một công cụ AI đã đọc `.env` hoặc dump, một phần mở rộng chưa được duyệt đã chạy trong repository của khách hàng, AI đã chạy lệnh làm thay đổi cloud.

1. **Dừng** session. Đừng cố dọn dẹp thông qua AI.
2. **Báo security owner ngay trong ngày**: chuyện gì, khi nào, công cụ nào, repository nào, dữ liệu nào.
3. **Rotate** mọi secret đã bị lộ. Việc này do người làm theo quy trình bình thường, không bao giờ do AI.
4. **Ghi nhận** sự cố và các bước tiếp theo (thay đổi settings, đào tạo, thay đổi rule).
5. Với dữ liệu của khách hàng, project lead cùng security owner quyết định có cần thông báo cho khách hàng hay không, theo yêu cầu của hợp đồng.

Báo cáo sớm là điều được mong đợi và không bao giờ bị phạt. Che giấu sự cố là vi phạm nghiêm trọng.
