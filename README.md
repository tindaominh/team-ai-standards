# Team AI-assisted development standard

**Version:** 0.3.0 · **Status:** Draft for Wave 1 pilot · **Owners:** see the Named people table in `docs/en/03-roles-and-responsibilities.md`

[English](#english) · [Tiếng Việt](#tiếng-việt)

## English

**Start here: [Quickstart](docs/en/00-quickstart.md)** — adopt the standard in a repository with one command and about 30 minutes of project details. **New project:** [Starting a new project](docs/en/12-new-project.md).

### Purpose

This repository defines how our team uses AI tools in software development. We build and maintain multi-channel e-commerce integration middleware: marketplace adapters, stock sync and order conversion. We work in Node.js/TypeScript (mostly NestJS), TypeORM, MySQL or PostgreSQL, and AWS. We handle client source code and customer data. The goal is faster delivery with the same or better quality, and without exposing confidential data.

### Scope

- Every developer on the team, every repository (internal and client) and every AI tool used for development work.
- Covered: which tools and data are allowed, the workflow and its evidence, roles, PR review, security, LLM features inside our products, context and cost, the rollout plan, documentation automation, and how this standard is versioned, adopted and updated.
- Not covered: general coding standards that our linters, CI and existing guidelines already define.

### Adopt in a repository

```bash
cd <your-repository>
node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
```

The script detects the stack from `package.json` (framework, databases, data access, AWS) and shows it; correct it with `--framework`, `--db`, `--data-access`, `--with` (or a shortcut such as `--stack nestjs-mysql`). Profiles: `strict` (client repositories, default) or `standard` (internal only). `--dry-run` writes nothing and prints every change, with diffs and a plan hash; `--yes` applies exactly that plan, on a clean branch. Existing files are merged, not overwritten: `CLAUDE.md` gets `std:` blocks, the PR template and `CODEOWNERS` get a block at the end, and stricter rules from an existing `settings.json` move into `.claude/project.json`. Anything that needs a person (for example `--repo-owner`) is listed under "Decisions required" (details in the quickstart).

### Running adoption

1. **Prerequisites.**
    - The checkout of this standard (where `adopt.mjs` runs from) is on a release tag with a clean working tree: `git -C ../team-ai-standards describe --tags` prints `vX.Y.Z` and `git -C ../team-ai-standards status` shows nothing. Otherwise `--dry-run` warns and `--yes` refuses, with the commands to fix it (`--allow-unreleased` is only for maintainers testing unreleased changes).
    - The project repository has a clean working tree and is on a branch other than the default branch (`git status`, `git switch -c chore/adopt-ai-standard`).
2. **Read the `--dry-run` output**, part by part:
    - **Standard checkout:** the release it runs from, and a warning when it is not a clean release.
    - **Values:** each configuration value and its source (flag, `project.json`, detected, default).
    - **Plan:** every file to create, modify or delete.
    - **Diffs:** `.claude/project.json`, `.claude/settings.json`, `CLAUDE.md` and the other modified files, as unified diffs.
    - **Permission rules:** each existing `allow` rule is covered (the profile grants it), unsafe (dropped, never carried), carried, dropped, or needs decision.
    - **Optional cleanup:** duplicates you may remove by hand; never done automatically.
    - **Decisions required:** what `--yes` refuses until you add a flag.
    - **Plan hash:** identifies exactly this plan.
3. **The loop.** Run `--dry-run`, resolve each "Decisions required" item by adding a flag (`--carry-allow "<rule>"` or `--drop-allow "<rule>"` per rule, `--drop-allow-rest`, `--repo-owner @org/team`, a stack flag), and run `--dry-run` again until no decisions remain. Then run `--yes` with **exactly the same flags**; add `--plan <hash>` to require the plan you reviewed.
4. **Example: an existing repository** whose `.claude/settings.json` allows `Bash(make test *)`, `Bash(make lint *)`, `Bash(make seed *)` and `Bash(docker compose up *)`:

    ```bash
    git switch -c chore/adopt-ai-standard
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
    # Existing allow rules: make test, make lint, make seed need a decision; docker compose up is unsafe
    # (the profile asks Bash(docker *)), so it is dropped. Decisions required: the three make rules, --repo-owner
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team \
      --carry-allow "Bash(make test *)" --carry-allow "Bash(make lint *)" --drop-allow-rest --dry-run
    # make seed is dropped by --drop-allow-rest (same as --drop-allow "Bash(make seed *)").
    # No decisions left; note the plan hash, for example 3f9c0a1b2c3d4e5f
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team \
      --carry-allow "Bash(make test *)" --carry-allow "Bash(make lint *)" --drop-allow-rest --yes --plan 3f9c0a1b2c3d4e5f
    ```

5. **Undo.** Everything happens on the branch: review with `git diff` and `git status`; to undo before committing, `git restore .` and `git clean -fd` (check first with `git clean -nd`); after committing, delete the branch.

### Adoption options

Adoption is two commands with the same options. `--dry-run` writes nothing: it shows every file to create, diffs of the files to change, permission changes, the source of each value (flag, `.claude/project.json`, detected or default), the decisions required and a plan hash. `--yes` applies exactly that plan. Configuration choices are stored in `.claude/project.json`, so later runs and update pull requests reuse them; a flag given later overrides the stored value. Run options (`--dry-run`, `--yes`, `--plan` and the others marked "not stored") are never stored. The table is generated from `scripts/lib/adopt-options.mjs` (`npm run docs:readme`); `node scripts/adopt.mjs --help` prints the same list.

<!-- AUTO-GENERATED:adopt-options START -->

| Option | Values | Default | Persisted in | Description |
| --- | --- | --- | --- | --- |
| `--profile` | `strict \| standard` | `strict` | `.claude/project.json` → `profile` | Settings profile: `strict` for client repositories, `standard` for internal repositories only. |
| `--framework` | `nestjs \| express \| none` | detected from `package.json` | `.claude/project.json` → `stack.framework` | Web framework. `none`: a service without a web framework (worker, consumer). |
| `--db` | `mysql \| postgres` | detected from `package.json` | `.claude/project.json` → `stack.databases` | Databases, one or more (repeat the option or separate with commas). |
| `--data-access` | `typeorm \| raw \| none` | detected from `package.json` | `.claude/project.json` → `stack.dataAccess` | Data-access library. `raw`: a driver without an ORM; `none`: no database. |
| `--with` | `aws` | detected (dependencies, `infra/` folders) | `.claude/project.json` → `stack.optional` | Optional fragments to install. |
| `--without-optional` | — | off | `.claude/project.json` → `stack.optional` (empty) | Install no optional fragment, even if one is detected. |
| `--stack` | `nestjs-mysql \| nestjs-postgres \| node-postgres` | none | `.claude/project.json` → `stack` (expanded) | Shortcut that sets every stack dimension; the options above override it. |
| `--with-docs` | — | off | `.claude/project.json` → `optionalGroups` | Also install the documentation checks (doc 09); updates keep them current. |
| `--repo-owner` | `@user \| @org/team` | none (required when there is no `CODEOWNERS`) | `.claude/project.json` → `repoOwner`; `CODEOWNERS` standard block | Owner of the project files (`CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/`). |
| `--carry-allow` | `<rule>` | none (decision required) | `.claude/project.json` → `permissions.allow` | Keep this `allow` rule from an existing `settings.json` that the profile does not grant. Repeat for each rule. Rules that overlap a profile `ask` or `deny` are refused. |
| `--drop-allow` | `<rule>` | none (decision required) | not stored (the rule is dropped) | Drop this `allow` rule instead. Repeat for each rule. |
| `--drop-allow-rest` | — | off | not stored (the rules are dropped) | Drop every `allow` rule not named with `--carry-allow` or `--drop-allow`. |
| `--propose-unresolved` | — | off | not stored | For files that cannot be merged, write `<file>.proposed` and a checklist instead of stopping. |
| `--dry-run` | — | off | not stored | Show the plan, the value sources and the plan hash; write nothing. |
| `--yes` | — | off | not stored | Apply the plan reviewed with `--dry-run`; stop if it changed. |
| `--plan` | `<hash>` | the plan recorded by `--dry-run` | not stored | With `--yes`: require this plan hash. |
| `--allow-unreleased` | — | off: `--yes` refuses a standard checkout that is dirty or not on its release tag | not stored (printed in the output) | For maintainers testing unreleased changes of the standard: run from a checkout that is not a clean release. Printed prominently in `--dry-run` and `--yes`. |
| `--target` | `<dir>` | current directory | not stored | Repository to adopt. |
| `--help` | — | off | not stored | Print this list and exit. |

<!-- AUTO-GENERATED:adopt-options END -->

Examples:

```bash
# New repository: detected stack, project owner for CODEOWNERS
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --yes

# Existing repository (its own CLAUDE.md, settings, CODEOWNERS): on a new branch with a clean tree
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --dry-run

# Explicit stack instead of detection
node ../team-ai-standards/scripts/adopt.mjs --profile standard --framework express --db mysql,postgres --data-access raw --with aws --repo-owner @acme/platform --dry-run
```

### Three layers in a project repository

| Layer | What | Who changes it |
| --- | --- | --- |
| 1. Standard | `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, generated `.claude/settings.json`, PR template, CODEOWNERS block, `std-check` workflow | Only update PRs from this repository |
| 2. Project | `CLAUDE.md`, `.claude/project.json` (stack, profile, commands, extra permissions), `.claude/rules/local/` | The repository's team, by PR |
| 3. Personal | `.claude/settings.local.json` | Each developer; never committed |

Details: `docs/en/10-versioning-and-distribution.md`.

### Contents

| Path | What it is |
| --- | --- |
| `docs/en/00-quickstart.md` | One page for developers: adopt, daily workflow, where to change things |
| `docs/en/01-ai-usage-policy.md` | Approved tools, data classification, accountability |
| `docs/en/02-development-workflow.md` | Plan → test → implement → verify → review → PR → merge, Definition of Done, evidence |
| `docs/en/03-roles-and-responsibilities.md` | Who does and approves what; the Named people table |
| `docs/en/04-pr-review-checklist.md` | Checklist for reviewing AI-assisted PRs |
| `docs/en/05-security-guidelines.md` | Prompt injection, permissions, extensions, hooks, secrets, incidents |
| `docs/en/06-llm-in-product-pattern.md` | How product features may call an LLM safely |
| `docs/en/07-context-and-cost.md` | What goes where, session hygiene, model choice |
| `docs/en/08-adoption-plan.md` | Three-wave rollout, metrics, training |
| `docs/en/09-docs-automation.md` | Keeping documentation current |
| `docs/en/10-versioning-and-distribution.md` | Versions, the three layers, adoption flags, update PRs |
| `docs/en/11-adding-a-stack-fragment.md` | How to add a framework, database or data-access fragment |
| `docs/en/12-new-project.md` | Starting a new project: scaffold or empty repository, adoption, prompts for Claude Code |
| `templates/prompts/` | Prompts for new projects (fill `CLAUDE.md`, specification, kickoff plan, feature ticket, scaffold), used as-is |
| `docs/vi/` | The same documents in Vietnamese, plus `ai-files-explained.md` |
| `templates/` | Layer 1 files exactly as a project repository receives them, the `CLAUDE.md` skeleton, and `fragments/` (composable stack fragments and their registry) |
| `scripts/adopt.mjs` | Adoption script, run from a project repository |
| `scripts/sync-standard.mjs` | Writes Layer 1 files for an update PR |
| `scripts/` (other) | Checks for this repository: parity, budget per stack, JSON, settings generator, README option tables and doc 12 prompts, audit exceptions, smoke tests |
| `.github/workflows/` | CI for this repository and the release update job |
| `audit-exceptions.json` | Accepted npm audit advisories for this repository's dev tools |
| `CHANGELOG.md` | Release history |

### Versioning

- Semantic versioning, CHANGELOG rules, release tags and update PRs: `docs/en/10-versioning-and-distribution.md`.
- Each project repository records its version in `.claude/STANDARD_VERSION`.
- Changes to this repository go through a PR; `npm run check` must pass locally: Markdown lint, JSON, settings, bilingual parity, context budget for every valid fragment combination, smoke tests. CI also runs actionlint on all workflows and checks `npm audit` against `audit-exceptions.json`.

## Tiếng Việt

**Bắt đầu tại đây: [Bắt đầu nhanh](docs/vi/00-quickstart.md)** — áp dụng bộ tiêu chuẩn vào một repo bằng một lệnh và khoảng 30 phút điền thông tin dự án. **Dự án mới:** [Bắt đầu một dự án mới](docs/vi/12-new-project.md).

### Mục đích

Repo này quy định cách team sử dụng công cụ AI trong phát triển phần mềm. Team xây dựng và vận hành middleware tích hợp thương mại điện tử đa kênh: adapter cho các marketplace, đồng bộ tồn kho, chuyển đổi đơn hàng. Stack là Node.js/TypeScript (chủ yếu NestJS), TypeORM, MySQL hoặc PostgreSQL, và AWS. Team làm việc với source code của khách hàng và dữ liệu khách hàng. Mục tiêu là giao hàng nhanh hơn, chất lượng bằng hoặc tốt hơn, và không để lộ dữ liệu mật.

### Phạm vi

- Áp dụng cho mọi developer trong team, mọi repo (nội bộ lẫn của khách hàng) và mọi công cụ AI dùng trong công việc phát triển.
- Bao gồm: công cụ và dữ liệu được phép, quy trình làm việc và bằng chứng (evidence), vai trò, review PR, bảo mật, tính năng có gọi LLM trong sản phẩm, context và chi phí, kế hoạch triển khai, tự động hoá tài liệu, và cách đánh version, áp dụng và cập nhật bộ tiêu chuẩn.
- Không bao gồm: coding standard chung đã được linter, CI và các hướng dẫn hiện có quy định.

### Áp dụng cho một repo

```bash
cd <your-repository>
node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --yes
```

Script tự nhận diện stack từ `package.json` (framework, database, data access, AWS) và in ra; sửa lại bằng `--framework`, `--db`, `--data-access`, `--with` (hoặc lối tắt như `--stack nestjs-mysql`). Profile: `strict` (repo khách hàng, mặc định) hoặc `standard` (chỉ repo nội bộ). `--dry-run` không ghi gì và in ra mọi thay đổi, kèm diff và plan hash; `--yes` áp dụng đúng plan đó, trên một branch sạch. File đã có được gộp chứ không bị ghi đè: `CLAUDE.md` có thêm các khối `std:`, PR template và `CODEOWNERS` có thêm một khối ở cuối, các rule chặt hơn trong `settings.json` đang có được chuyển vào `.claude/project.json`. Những gì cần con người quyết định (ví dụ `--repo-owner`) được liệt kê trong "Decisions required" (chi tiết trong quickstart).

### Chạy adopt

1. **Điều kiện trước.**
    - Checkout của standard này (nơi chạy `adopt.mjs`) ở một tag release và working tree sạch: `git -C ../team-ai-standards describe --tags` in ra `vX.Y.Z` và `git -C ../team-ai-standards status` không có gì. Nếu không, `--dry-run` cảnh báo và `--yes` từ chối, kèm lệnh để sửa (`--allow-unreleased` chỉ dành cho maintainer thử thay đổi chưa release).
    - Repo dự án có working tree sạch và đang ở một branch khác default branch (`git status`, `git switch -c chore/adopt-ai-standard`).
2. **Đọc output của `--dry-run`**, từng phần:
    - **Standard checkout:** bản release đang chạy, và cảnh báo nếu không phải bản release sạch.
    - **Values:** từng giá trị cấu hình và nguồn của nó (flag, `project.json`, detect, mặc định).
    - **Plan:** mọi file sẽ tạo, sửa hoặc xoá.
    - **Diff:** `.claude/project.json`, `.claude/settings.json`, `CLAUDE.md` và các file bị sửa khác, dạng unified diff.
    - **Permission rules:** mỗi rule `allow` đang có là covered (profile đã cấp), unsafe (bị bỏ, không bao giờ được giữ), carried, dropped, hoặc needs decision.
    - **Optional cleanup:** phần trùng lặp bạn có thể tự xoá; không bao giờ làm tự động.
    - **Decisions required:** những gì `--yes` từ chối cho đến khi bạn thêm flag.
    - **Plan hash:** định danh đúng plan này.
3. **Vòng lặp.** Chạy `--dry-run`, giải quyết từng mục "Decisions required" bằng cách thêm flag (`--carry-allow "<rule>"` hoặc `--drop-allow "<rule>"` cho từng rule, `--drop-allow-rest`, `--repo-owner @org/team`, flag về stack), rồi chạy lại `--dry-run` cho đến khi không còn quyết định nào. Sau đó chạy `--yes` với **đúng các flag đó**; thêm `--plan <hash>` để bắt buộc đúng plan đã xem.
4. **Ví dụ: repo đã có sẵn** với `.claude/settings.json` cho phép `Bash(make test *)`, `Bash(make lint *)`, `Bash(make seed *)` và `Bash(docker compose up *)`:

    ```bash
    git switch -c chore/adopt-ai-standard
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --dry-run
    # Existing allow rules: make test, make lint, make seed cần quyết định; docker compose up là unsafe
    # (profile ask Bash(docker *)) nên bị bỏ. Decisions required: ba rule make, --repo-owner
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team \
      --carry-allow "Bash(make test *)" --carry-allow "Bash(make lint *)" --drop-allow-rest --dry-run
    # make seed bị bỏ bởi --drop-allow-rest (giống --drop-allow "Bash(make seed *)").
    # Không còn quyết định nào; ghi lại plan hash, ví dụ 3f9c0a1b2c3d4e5f
    node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team \
      --carry-allow "Bash(make test *)" --carry-allow "Bash(make lint *)" --drop-allow-rest --yes --plan 3f9c0a1b2c3d4e5f
    ```

5. **Hoàn tác.** Mọi thứ diễn ra trên branch: xem lại bằng `git diff` và `git status`; để hoàn tác trước khi commit, chạy `git restore .` và `git clean -fd` (kiểm tra trước bằng `git clean -nd`); sau khi commit thì xoá branch.

### Tuỳ chọn của adopt.mjs

Áp dụng gồm hai lệnh với cùng các tuỳ chọn. `--dry-run` không ghi gì: in ra mọi file sẽ tạo, diff của các file sẽ sửa, thay đổi về permission, nguồn của từng giá trị (flag, `.claude/project.json`, detect hoặc mặc định), các quyết định cần đưa ra và một plan hash. `--yes` áp dụng đúng plan đó. Các lựa chọn cấu hình được lưu trong `.claude/project.json`, nên các lần chạy sau và các pull request cập nhật dùng lại chúng; flag truyền ở lần sau sẽ ghi đè giá trị đã lưu. Các tuỳ chọn điều khiển lần chạy (`--dry-run`, `--yes`, `--plan` và các tuỳ chọn ghi "không lưu") không bao giờ được lưu. Bảng được sinh từ `scripts/lib/adopt-options.mjs` (`npm run docs:readme`); `node scripts/adopt.mjs --help` in ra cùng danh sách.

<!-- AUTO-GENERATED:adopt-options-vi START -->

| Tuỳ chọn | Giá trị | Mặc định | Lưu ở | Mô tả |
| --- | --- | --- | --- | --- |
| `--profile` | `strict \| standard` | `strict` | `.claude/project.json` → `profile` | Profile settings: `strict` cho repo khách hàng, `standard` chỉ cho repo nội bộ. |
| `--framework` | `nestjs \| express \| none` | detect từ `package.json` | `.claude/project.json` → `stack.framework` | Web framework. `none`: service không có web framework (worker, consumer). |
| `--db` | `mysql \| postgres` | detect từ `package.json` | `.claude/project.json` → `stack.databases` | Database, một hoặc nhiều (lặp lại option hoặc ngăn cách bằng dấu phẩy). |
| `--data-access` | `typeorm \| raw \| none` | detect từ `package.json` | `.claude/project.json` → `stack.dataAccess` | Thư viện data access. `raw`: driver không có ORM; `none`: không có database. |
| `--with` | `aws` | detect (dependency, thư mục `infra/`) | `.claude/project.json` → `stack.optional` | Các fragment tuỳ chọn cần cài. |
| `--without-optional` | — | tắt | `.claude/project.json` → `stack.optional` (rỗng) | Không cài fragment tuỳ chọn nào, kể cả khi detect được. |
| `--stack` | `nestjs-mysql \| nestjs-postgres \| node-postgres` | không có | `.claude/project.json` → `stack` (đã khai triển) | Lối tắt đặt mọi chiều của stack; các option ở trên ghi đè lên nó. |
| `--with-docs` | — | tắt | `.claude/project.json` → `optionalGroups` | Cài thêm các kiểm tra tài liệu (tài liệu 09); bản cập nhật giữ chúng mới. |
| `--repo-owner` | `@user \| @org/team` | không có (bắt buộc khi chưa có `CODEOWNERS`) | `.claude/project.json` → `repoOwner`; khối standard trong `CODEOWNERS` | Owner của các file dự án (`CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/`). |
| `--carry-allow` | `<rule>` | không có (cần quyết định) | `.claude/project.json` → `permissions.allow` | Giữ rule `allow` này trong `settings.json` đang có mà profile không cấp. Lặp lại cho từng rule. Rule chồng lên `ask` hoặc `deny` của profile bị từ chối. |
| `--drop-allow` | `<rule>` | không có (cần quyết định) | không lưu (rule bị bỏ) | Bỏ rule `allow` này. Lặp lại cho từng rule. |
| `--drop-allow-rest` | — | tắt | không lưu (các rule bị bỏ) | Bỏ mọi rule `allow` không được nêu bằng `--carry-allow` hoặc `--drop-allow`. |
| `--propose-unresolved` | — | tắt | không lưu | Với file không gộp được, ghi `<file>.proposed` và một checklist thay vì dừng. |
| `--dry-run` | — | tắt | không lưu | In plan, nguồn của từng giá trị và plan hash; không ghi gì. |
| `--yes` | — | tắt | không lưu | Áp dụng plan đã xem bằng `--dry-run`; dừng nếu plan đã thay đổi. |
| `--plan` | `<hash>` | plan được `--dry-run` lưu lại | không lưu | Dùng với `--yes`: yêu cầu đúng plan hash này. |
| `--allow-unreleased` | — | tắt: `--yes` từ chối checkout standard chưa sạch hoặc không ở đúng tag release | không lưu (in ra trong output) | Cho maintainer thử thay đổi chưa release của standard: chạy từ checkout không phải bản release sạch. Được in rõ trong `--dry-run` và `--yes`. |
| `--target` | `<dir>` | thư mục hiện tại | không lưu | Repository cần áp dụng. |
| `--help` | — | tắt | không lưu | In danh sách này rồi thoát. |

<!-- AUTO-GENERATED:adopt-options-vi END -->

Ví dụ:

```bash
# Repo mới: stack được detect, owner của dự án cho CODEOWNERS
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --yes

# Repo đã có CLAUDE.md, settings, CODEOWNERS riêng: trên một branch mới, working tree sạch
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @acme/orders-team --dry-run

# Chọn stack rõ ràng thay vì detect
node ../team-ai-standards/scripts/adopt.mjs --profile standard --framework express --db mysql,postgres --data-access raw --with aws --repo-owner @acme/platform --dry-run
```

### Ba lớp trong một repo dự án

| Lớp | Gồm những gì | Ai được thay đổi |
| --- | --- | --- |
| 1. Tiêu chuẩn | `.claude/rules/std/`, agent và skill `std-*`, `.claude/std/`, `.claude/settings.json` (được sinh ra), PR template, khối trong CODEOWNERS, workflow `std-check` | Chỉ qua PR cập nhật từ repo này |
| 2. Dự án | `CLAUDE.md`, `.claude/project.json` (stack, profile, lệnh, quyền bổ sung), `.claude/rules/local/` | Team của repo, qua PR |
| 3. Cá nhân | `.claude/settings.local.json` | Từng developer; không bao giờ commit |

Chi tiết: `docs/vi/10-versioning-and-distribution.md`.

### Nội dung

| Đường dẫn | Là gì |
| --- | --- |
| `docs/vi/00-quickstart.md` | Một trang cho developer: áp dụng, quy trình hằng ngày, sửa ở đâu |
| `docs/vi/01-ai-usage-policy.md` | Công cụ được duyệt, phân loại dữ liệu, trách nhiệm |
| `docs/vi/02-development-workflow.md` | Plan → test → code → verify → review → PR → merge, Definition of Done, bằng chứng |
| `docs/vi/03-roles-and-responsibilities.md` | Ai làm gì, ai duyệt gì; bảng Named people |
| `docs/vi/04-pr-review-checklist.md` | Checklist review PR có AI hỗ trợ |
| `docs/vi/05-security-guidelines.md` | Prompt injection, quyền, extension, hook, secret, xử lý sự cố |
| `docs/vi/06-llm-in-product-pattern.md` | Cách tính năng sản phẩm gọi LLM một cách an toàn |
| `docs/vi/07-context-and-cost.md` | Nội dung nào đặt ở đâu, giữ session gọn, chọn model |
| `docs/vi/08-adoption-plan.md` | Triển khai 3 đợt, chỉ số, đào tạo |
| `docs/vi/09-docs-automation.md` | Giữ tài liệu luôn cập nhật |
| `docs/vi/10-versioning-and-distribution.md` | Version, ba lớp, flag khi áp dụng, PR cập nhật |
| `docs/vi/11-adding-a-stack-fragment.md` | Cách thêm fragment cho framework, database hoặc data access |
| `docs/vi/12-new-project.md` | Bắt đầu một dự án mới: scaffold hoặc repo rỗng, adopt, prompt cho Claude Code |
| `templates/prompts/` | Prompt cho dự án mới (điền `CLAUDE.md`, đặc tả, plan khởi động, ticket tính năng, scaffold), dùng nguyên văn |
| `docs/vi/ai-files-explained.md` | Giải thích bằng tiếng Việt từng file dành cho AI |
| `templates/` | File lớp 1 đúng như repo dự án nhận được, khung `CLAUDE.md`, và `fragments/` (các stack fragment ghép được và registry của chúng) |
| `scripts/adopt.mjs` | Script áp dụng, chạy từ repo dự án |
| `scripts/sync-standard.mjs` | Ghi các file lớp 1 cho PR cập nhật |
| `scripts/` (còn lại) | Công cụ kiểm tra cho repo này: parity, budget theo từng stack, JSON, sinh settings, bảng tuỳ chọn trong README và prompt trong tài liệu 12, ngoại lệ audit, smoke test |
| `.github/workflows/` | CI của repo này và job cập nhật khi phát hành |
| `audit-exceptions.json` | Các cảnh báo npm audit đã chấp nhận cho công cụ dev của repo này |
| `CHANGELOG.md` | Lịch sử phát hành |

### Đánh version

- Semantic versioning, quy tắc CHANGELOG, tag phát hành và PR cập nhật: `docs/vi/10-versioning-and-distribution.md`.
- Mỗi repo dự án ghi version đang dùng trong `.claude/STANDARD_VERSION`.
- Mọi thay đổi trong repo này đi qua PR; `npm run check` phải pass ở máy local: Markdown lint, JSON, settings, parity hai ngôn ngữ, context budget cho mọi tổ hợp fragment hợp lệ, smoke test. CI chạy thêm actionlint cho mọi workflow và đối chiếu `npm audit` với `audit-exceptions.json`.
