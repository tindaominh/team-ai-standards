# 05. Hướng dẫn bảo mật khi phát triển có AI hỗ trợ

## Mục đích

Cách chúng ta giữ an toàn cho source code của khách hàng, dữ liệu khách hàng và credential khi các công cụ AI làm việc trong repository của mình. Tài liệu bao gồm prompt injection, threat model, quyền (permission), cách ly (isolation), các phần mở rộng (plugin, skill, hook, MCP server), quản lý secret và xử lý sự cố.

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

## 3. Threat model

**Permission rule là rào chắn chống nhầm lẫn, không phải ranh giới bảo mật.** Chúng giúp AI không vô tình chạy nhầm lệnh và buộc AI hỏi trước các lệnh rủi ro. Chúng không ngăn được code do chính AI viết ra chạy.

- Các lệnh mà profile cho chạy không cần hỏi (test, lint, typecheck, build) thực thi code trong repository: file test, config của tool như `eslint.config.*`, `vitest.config.*` hay `jest.config.*`, script trong package và git hook. AI viết được tất cả những thứ đó. Một file test có thể đọc `~/.aws/credentials`, gọi mạng hoặc chạy `cdk synth`, trong khi lệnh nhìn thấy vẫn chỉ là `pnpm test`.
- Code chạy bên trong Node không bị Bash rule, cũng không bị deny rule cho `Read` và `Edit` bắt. Tài liệu chính thức ("Configure permissions", <https://code.claude.com/docs/en/permissions>) ghi rằng deny rule cho `Read` và `Edit` "don't apply to a command that reads files without naming them … or to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox."

**Ranh giới thật sự là môi trường:** những credential và quyền truy cập mạng nào tồn tại ở nơi AI chạy. Secret không có trên máy thì không thể bị lộ, và session cloud đã hết hạn thì không dùng được.

Các biện pháp trong bộ tiêu chuẩn:

| Biện pháp | Ở đâu |
| --- | --- |
| Hỏi trước khi sửa guard file: file làm thay đổi những gì lệnh được phép sẽ chạy, hoặc làm yếu rào chắn | 4, "Cả hai profile đều hỏi (ask) trước khi" |
| Guard file thuộc owner của repository trong `CODEOWNERS`, và reviewer kiểm tra chúng kỹ hơn | Block standard trong `CODEOWNERS`; 04, mục 12 |
| Adopt bỏ rule `allow` có sẵn nếu script package của nó chạy một lệnh mà profile hỏi hoặc chặn | 10, mục 6 |
| Không có secret thật trong file `.env` trong repository; secret được inject lúc chạy | 6; 01 |
| Credential cloud có thời hạn ngắn hoặc có MFA; không có access key dài hạn trên máy developer | 6; 01 |
| Secret của CI chỉ nằm trong GitHub environment có required reviewer | 6; 09 |
| Nội dung từ bên ngoài là dữ liệu, không phải chỉ dẫn | 2; rule `untrusted-content.md` |
| Cách ly (tuỳ chọn, khuyến nghị cho repository của khách hàng) | 3.1 |

### 3.1 Cách ly (tuỳ chọn, khuyến nghị cho repository của khách hàng)

Cách ly giới hạn những gì lệnh có thể chạm tới, bất kể permission rule ghi gì. Các lựa chọn dưới đây là những gì tài liệu chính thức của Claude Code mô tả; chỉ dùng các setting mà tài liệu ghi. Profile của bộ tiêu chuẩn không đặt chúng: hãy đặt trong user settings hoặc `.claude/settings.local.json`.

**Sandbox của Claude Code** (<https://code.claude.com/docs/en/sandboxing>):

- Phạm vi: "The Bash sandbox is a boundary that the operating system enforces around the shell commands Claude runs on your machine … the limits apply to Bash, PowerShell, and Monitor commands and the processes they start." Nghĩa là nó cũng bao phủ code mà lệnh test và build chạy.
- Nền tảng: "The sandbox runs on macOS, Linux, and WSL2. On native Windows, Claude Code runs commands unsandboxed." macOS dùng Seatbelt có sẵn; Linux và WSL2 cần `bubblewrap` và `socat`.
- Bật: "The sandbox is off by default. To turn it on, run `/sandbox` in a session … or set `sandbox.enabled` to `true` in a settings file".
- Mặc định: ghi được vào "The working directory, a per-user temp directory, and directories you've added"; đọc được "Most of the machine, including credential files such as `~/.ssh` and `~/.aws/credentials`" trừ khi bạn chặn bằng `filesystem.denyRead` hoặc `sandbox.credentials`; kết nối mạng "go through a proxy on your machine that checks each host against your allowed domains, which start empty"; biến môi trường được "Inherited from Claude Code, including any secrets in its environment".
- Credential: các mục trong `sandbox.credentials` với `"mode": "deny"` khiến đường dẫn file không đọc được trong sandbox và gỡ biến môi trường "before each sandboxed command runs". "There is no built-in credential deny list, so only the files and variables you list are restricted." Ít nhất hãy chặn `~/.aws` và `~/.ssh`.
- Chạy lại ngoài sandbox: Claude có thể chạy lại một lệnh bị lỗi mà không có sandbox (`dangerouslyDisableSandbox`). Đặt `"allowUnsandboxedCommands": false` để tắt việc này ("strict sandbox mode").
- Không bao phủ: "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks run outside it." Lệnh bạn tự gõ ở dấu nhắc `!` và lệnh nằm trong `excludedCommands` cũng chạy ngoài sandbox.

**Dev container, container khác hoặc máy ảo** (<https://code.claude.com/docs/en/sandbox-environments>):

- Các cách này đặt "the whole Claude Code process inside the isolation boundary, so file tools, MCP servers, and hooks are restricted too".
- Claude Code công bố một dev container mẫu "with a default-deny iptables firewall as a starting point" (<https://code.claude.com/docs/en/devcontainer>). Copy nó vào repository rồi chỉnh allowlist của firewall, base image và version Claude Code đã pin. Chỉ mount project và những credential mà task cần.
- Commit nó vào repository là "a convention rather than an enforcement boundary, because Claude Code does not require a container."

Giới hạn, theo cùng trang đó: "Any approach that allows network egress can still leak data the agent can read, and any approach that mounts your project directory writable can still modify that code." Chế độ bypass permissions vẫn bị profile của team tắt, kể cả trong container.

## 4. Permission

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
- Lệnh khởi chạy tiến trình dài hoặc dùng credential thật: dev server (`npm/pnpm/yarn dev*`, `start*`, `serve*`, `watch*`, `next dev`, `nest start`, `vite`) và công cụ hạ tầng (`cdk`, `terraform`, `sam`, `serverless`/`sls`, `pulumi`, `copilot`, `eb`, và các script `cdk*` trong package). `cdk diff` và `cdk synth` đọc tài khoản cloud thật của developer. Các dạng deploy và destroy vẫn bị chặn.
- Sửa guard file: mọi `package.json`, `.claude/project.json`, `.claude/rules/local/**`, `.husky/**`, `.github/workflows/**`, và các config mà lệnh được phép sẽ thực thi (`eslint.config.*`, `.eslintrc*`, `vitest.config.*`, `jest.config.*`, `tsconfig*.json`). Chúng làm thay đổi những gì lệnh được phép sẽ chạy, hoặc làm yếu rào chắn. Các rule được viết dạng `Edit(...)`, ví dụ `Edit(**/package.json)` và `Edit(/.github/workflows/**)`: tài liệu ghi rằng "`Edit` rules apply to all built-in tools that edit files", và với path rule viết cho `Write` thì "Claude Code accepts the rule but never consults it". Không vì thế mà tool `Write` bị bỏ ngỏ: tài liệu tools reference (<https://code.claude.com/docs/en/tools-reference>) ghi dạng rule `Edit(/src/**)` áp dụng cho "Edit, Write, NotebookEdit", và mô tả Write là tool "creates a new file or overwrites an existing one with the full content provided". Vì vậy ghi đè toàn bộ file và tạo file mới cũng đi qua cùng các ask rule `Edit(...)`. Pattern `/path` tính từ project của file settings, còn `**/` khớp ở mọi độ sâu. Ask rule hỏi ở mọi chế độ: tài liệu liệt kê "Tools matched by an explicit ask rule" trong số các hành động mà "Claude Code doesn't auto-approve … in any mode, including `bypassPermissions`" (<https://code.claude.com/docs/en/permission-modes>). Giống mọi rule `Edit`, chúng không chặn được script tự ghi file (3).

Cả hai profile cho phép không cần hỏi:

- Các lệnh build, lint, typecheck, unit test, integration test và xem trạng thái migration của repository, `npm audit`, và các lệnh git chỉ đọc.
- Trong template, các lệnh này được ghi dưới dạng placeholder (`<build-cmd>`, `<unit-test-cmd>`, …). Hãy thay bằng lệnh trong bảng lệnh của CLAUDE.md. Placeholder chưa điền sẽ không khớp với lệnh nào, nên lệnh đó chỉ đơn giản là phải hỏi.

Giới hạn của permission rule (theo tài liệu chính thức của Claude Code, trang "Configure permissions"):

- Dấu `*` ở cuối, có dấu cách đứng trước, cũng khớp với lệnh không có đối số: "`Bash(ls *)` matches `ls`, and `Bash(git log *)` matches `git log`. That holds only when the trailing `*` is the rule's only wildcard." Vì vậy `Bash(pnpm test *)` cũng cho phép `pnpm test`, và ask `Bash(pnpm migration:run *)` cũng hỏi với `pnpm migration:run`.
- Rule cho Bash so khớp với nội dung câu lệnh mà Claude viết ra. Tài liệu ghi rõ rule như vậy "covers the invocation Claude usually produces and isn't a security boundary around the program", tức là nó chỉ chặn cách gọi thông thường chứ không phải ranh giới bảo mật quanh chương trình. Cùng chương trình đó nếu được gọi bằng đường dẫn đầy đủ, bên trong `sh -c`, hoặc từ một script thì sẽ không bị khớp.
- Deny rule cho `Read` và `Edit` cũng áp dụng cho các lệnh đọc/ghi file mà Claude Code nhận diện được trong Bash (`cat`, `head`, `tail`, `sed`, `tee`) và cho redirection. Chúng **không** áp dụng cho lệnh đọc file mà không nêu tên file (ví dụ `grep -r pattern .`) hoặc script tự mở file.
- Deny rule trong `permissions.deny` áp dụng cho cả cuộc hội thoại chính lẫn các subagent.
- Vì vậy: permission rule là rào chắn, không phải ranh giới (3). Không để secret thật trong working copy và theo dõi những gì AI chạy. Để chặn ở mức hệ điều hành, dùng cách ly (3.1).

Ghi đè ở local:

- `.claude/settings.json` được sinh ra từ base profile và `.claude/project.json`; không bao giờ sửa tay. Rule riêng của repository đặt trong `permissions` của `.claude/project.json`.
- Thay đổi cá nhân đặt trong `.claude/settings.local.json` (không bao giờ commit). Rule deny và ask của bộ tiêu chuẩn vẫn có hiệu lực: tài liệu chính thức ghi rõ "if a tool is denied at any level, no other level can allow it" (công cụ đã bị deny ở bất kỳ cấp nào thì không cấp nào khác cho phép lại được). Những gì được và không được đặt trong file đó liệt kê ở tài liệu 10, mục "Personal settings (Layer 3)". Bạn không được nới rule cho repository của khách hàng nếu chưa có phê duyệt của security owner.

## 5. Phần mở rộng của bên thứ ba: plugin, skill, hook, MCP server

Phần mở rộng thêm chỉ dẫn, tool hoặc code vào session AI của bạn. Một số chạy code trên máy bạn ở mỗi lần gọi tool; một số kết nối tới dịch vụ từ xa. Đánh giá mọi phần mở rộng theo các quy tắc dưới đây trước khi cài, kể cả khi nó rất phổ biến.

### 5.1 Những rủi ro cần tìm

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

### 5.2 Quy tắc đánh giá

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

### 5.3 MCP server

- Chỉ dùng MCP server được security owner phê duyệt, đã pin version, với scope và token tối thiểu.
- Ưu tiên quyền chỉ đọc. Một server có quyền ghi vào công cụ ticket, nơi host repository hoặc tài khoản cloud là một phê duyệt rủi ro cao.
- Không tự động bật server được khai báo trong repository (`enableAllProjectMcpServers` là `false` trong settings của team).
- Credential cho MCP server nằm trong secret store hoặc biến môi trường trên máy bạn, không bao giờ trong file được commit.

### 5.4 Hook của team

Hook của team chỉ được **kiểm tra** hoặc **nhắc nhở**. Hook của team không bao giờ được ghi hoặc sửa file trong repository, ghi file dùng chung (docs, CLAUDE.md, settings), commit hay push, gọi mạng, tải bất cứ thứ gì về, hoặc gửi dữ liệu ra khỏi máy. Việc ghi và công bố thay đổi do developer làm, hoặc do CI làm trên pull request (xem 09).

Các hook tuỳ chọn của team (`.claude/std/hooks/`, bật bằng `"hooks": true` trong `.claude/project.json`) tuân theo quy tắc này: tất định, chỉ chạy binary local ở chế độ kiểm tra, và ghi rõ chúng đọc và chạy những gì. Mọi hook mới đều phải qua cùng quy trình review.

## 6. Quản lý secret

- Secret của production và staging nằm trong AWS Secrets Manager hoặc SSM Parameter Store. Ứng dụng đọc chúng lúc runtime qua module config.
- Khi làm việc với AI, file `.env` trong repository chỉ chứa giá trị local hoặc giả. Secret thật được inject lúc chạy từ CLI của password manager hoặc một secret store tương tự, ví dụ `<secret-cli> run -- npm start`, để chúng chỉ tồn tại trong môi trường của lệnh cần dùng. Deny đọc `.env` của profile chỉ là lớp thứ hai: nó không ngăn được test hay script tự mở file (3).
- Không khởi động Claude Code từ một shell có secret thật trong biến môi trường: mọi lệnh AI chạy đều kế thừa chúng.
- Credential cloud trên máy developer phải có thời hạn ngắn (SSO hoặc session assume role) hoặc được bảo vệ bằng MFA. Không có access key dài hạn trên máy developer, ví dụ key tĩnh trong `~/.aws/credentials`.
- Commit một file `config/env.example` với tên biến và giá trị giả. AI đọc được file này; AI không đọc được `.env`.
- CI dùng GitHub OIDC để assume AWS role. Không để AWS key dài hạn trong GitHub secrets.
- Mọi job CI dùng secret phải chạy trong một GitHub environment có required reviewer và giới hạn deployment branch ở branch mặc định (hoặc tag release). Secret là environment secret, không bao giờ là secret của repository hay organisation, để một workflow bị sửa trên branch chưa review không đọc được chúng. Theo tài liệu GitHub (<https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>): "Secrets stored in an environment are only available to workflow jobs that reference the environment", và "If the environment requires approval, a job cannot access environment secrets until one of the required reviewers approves it."
- Tạo environment trước khi workflow chạy lần đầu: "Running a workflow that references an environment that does not exist will create an environment with the referenced name", và environment đó "will not have any protection rules or secrets configured" (<https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>).
- Không phải gói GitHub nào cũng bảo vệ được environment trong repository private: xem 6.1 trước khi bật workflow dùng secret.
- Một công cụ quét secret chạy trong CI và chặn PR khi phát hiện.
- Không bao giờ paste secret vào prompt, ticket, PR hay chat, kể cả "chỉ một giây".

### 6.1 Yêu cầu về gói GitHub cho environment trong repository private

Theo tài liệu GitHub ("Deployments and environments", <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>, và "Managing environments for deployment", <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>):

- "Users with GitHub Free plans can only configure environments for public repositories. If you convert a repository from public to private, any configured protection rules or environment secrets will be ignored, and you will not be able to configure any environments."
- "Organizations with GitHub Team and users with GitHub Pro can configure environments for private repositories."
- "If you are using GitHub Free, environment secrets are only available in public repositories. For access to environment secrets in private or internal repositories, you must use GitHub Pro, GitHub Team, or GitHub Enterprise."
- "Deployment branches and tags are available for all public repositories. For users on GitHub Pro or GitHub Team plans, deployment branches and tags are also available for private repositories."
- "If you are on a GitHub Free, GitHub Pro, or GitHub Team plan, required reviewers are only available for public repositories." Câu tương tự được ghi cho wait timer, và custom deployment protection rule "are only available for public repositories for users on GitHub Free, GitHub Pro, and GitHub Team plans."

Vì vậy, với repository private:

| Gói | Environment secret | Deployment branch và tag | Required reviewer, wait timer |
| --- | --- | --- | --- |
| GitHub Free | Không | Không | Không |
| GitHub Pro, GitHub Team | Có | Có | Không |
| GitHub Enterprise | Có | Có | Có (các giới hạn ở trên chỉ nêu Free, Pro và Team) |

Điều gì xảy ra khi thiếu chúng. Job tham chiếu tới một environment vẫn luôn chạy; environment chỉ chặn thông qua protection rule của nó: "Deployment protection rules require specific conditions to pass before a job referencing the environment can proceed."

- **Không có required reviewer (GitHub Pro hoặc Team):** environment tồn tại và secret của nó tách khỏi secret của repository, nhưng không ai duyệt từng lần chạy. Khi đó rule deployment branch là biện pháp kiểm soát duy nhất. Đặt nó là **Selected branches and tags** với branch mặc định (hoặc tag release), và bảo vệ branch đó. Workflow bị sửa trên branch khác không dùng được environment, nhưng thay đổi workflow đã merge vào branch mặc định sẽ chạy với secret mà không cần người thứ hai duyệt. Đó là lý do `.github/workflows/**` là guard file (4) có owner trong `CODEOWNERS` (04, mục 12).
- **Không có environment (GitHub Free):** workflow vẫn tham chiếu environment nhưng không cấu hình được gì, nên nó không chặn gì cả, và secret sẽ phải là secret của repository mà workflow trên bất kỳ branch nào cũng đọc được. Không bật workflow dùng secret (`docs-notify`, `docs-ai-proposal`) trong repository như vậy nếu chưa có phê duyệt bằng văn bản của security owner.
- **Environment chưa bao giờ được cấu hình (mọi gói):** GitHub tạo nó ở lần chạy đầu, và nó "will not have any protection rules or secrets configured", nên job chạy và không tìm thấy secret nào. Hãy cấu hình trước.

## 7. Dữ liệu cá nhân và dữ liệu khách hàng

- Không bao giờ đưa cho AI dữ liệu production, dump, log hoặc ticket hỗ trợ có dữ liệu khách hàng.
- Tái hiện bug bằng dữ liệu giả lập.
- Khi chính một feature gửi dữ liệu cho LLM ở production, làm theo 06-llm-in-product-pattern và xin phê duyệt của security owner.

## 8. Sự cố

Ví dụ: một secret bị hiển thị cho hoặc bị paste vào công cụ AI, một công cụ AI đã đọc `.env` hoặc dump, một phần mở rộng chưa được duyệt đã chạy trong repository của khách hàng, AI đã chạy lệnh làm thay đổi cloud.

1. **Dừng** session. Đừng cố dọn dẹp thông qua AI.
2. **Báo security owner ngay trong ngày**: chuyện gì, khi nào, công cụ nào, repository nào, dữ liệu nào.
3. **Rotate** mọi secret đã bị lộ. Việc này do người làm theo quy trình bình thường, không bao giờ do AI.
4. **Ghi nhận** sự cố và các bước tiếp theo (thay đổi settings, đào tạo, thay đổi rule).
5. Với dữ liệu của khách hàng, project lead cùng security owner quyết định có cần thông báo cho khách hàng hay không, theo yêu cầu của hợp đồng.

Báo cáo sớm là điều được mong đợi và không bao giờ bị phạt. Che giấu sự cố là vi phạm nghiêm trọng.
