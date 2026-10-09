// Every option of scripts/adopt.mjs, in one place. The argument parser, `--help`
// and the README tables (scripts/generate-readme.mjs) are all built from this list,
// so they cannot drift apart.
//   name      option without "--"
//   value     how the value is written (null: a flag without a value); a function
//             reads the registry, so stack values follow templates/fragments/fragments.json
//   repeat    may be given more than once or comma-separated
//   kind      config (a choice that is stored and reused) or run (controls one run, never stored)
//   default, persisted, en, vi   text for --help and the README (vi: Vietnamese; option
//             names and values stay unchanged)
import { registry } from './standard.mjs';

const values = (dim) => () => Object.keys(registry().dimensions[dim].values).join(' \\| ');
const PJ = '`.claude/project.json`';

export const OPTIONS = [
  {
    name: 'profile', value: () => 'strict \\| standard', kind: 'config',
    default: { en: '`strict`', vi: '`strict`' },
    persisted: { en: `${PJ} → \`profile\``, vi: `${PJ} → \`profile\`` },
    en: 'Settings profile: `strict` for client repositories, `standard` for internal repositories only.',
    vi: 'Profile settings: `strict` cho repo khách hàng, `standard` chỉ cho repo nội bộ.'
  },
  {
    name: 'framework', value: values('framework'), kind: 'config',
    default: { en: 'detected from `package.json`', vi: 'detect từ `package.json`' },
    persisted: { en: `${PJ} → \`stack.framework\``, vi: `${PJ} → \`stack.framework\`` },
    en: 'Web framework. `none`: a service without a web framework (worker, consumer).',
    vi: 'Web framework. `none`: service không có web framework (worker, consumer).'
  },
  {
    name: 'db', value: values('databases'), repeat: true, kind: 'config',
    default: { en: 'detected from `package.json`', vi: 'detect từ `package.json`' },
    persisted: { en: `${PJ} → \`stack.databases\``, vi: `${PJ} → \`stack.databases\`` },
    en: 'Databases, one or more (repeat the option or separate with commas).',
    vi: 'Database, một hoặc nhiều (lặp lại option hoặc ngăn cách bằng dấu phẩy).'
  },
  {
    name: 'data-access', value: values('dataAccess'), kind: 'config',
    default: { en: 'detected from `package.json`', vi: 'detect từ `package.json`' },
    persisted: { en: `${PJ} → \`stack.dataAccess\``, vi: `${PJ} → \`stack.dataAccess\`` },
    en: 'Data-access library. `raw`: a driver without an ORM; `none`: no database.',
    vi: 'Thư viện data access. `raw`: driver không có ORM; `none`: không có database.'
  },
  {
    name: 'with', value: values('optional'), repeat: true, kind: 'config',
    default: { en: 'detected (dependencies, `infra/` folders)', vi: 'detect (dependency, thư mục `infra/`)' },
    persisted: { en: `${PJ} → \`stack.optional\``, vi: `${PJ} → \`stack.optional\`` },
    en: 'Optional fragments to install: `aws` (detected), `marketplace` (channel adapters, stock sync, orders; never detected).',
    vi: 'Các fragment tuỳ chọn cần cài: `aws` (được detect), `marketplace` (adapter kênh bán, đồng bộ tồn kho, đơn hàng; không bao giờ tự detect).'
  },
  {
    name: 'without-optional', value: null, kind: 'config',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: `${PJ} → \`stack.optional\` (empty)`, vi: `${PJ} → \`stack.optional\` (rỗng)` },
    en: 'Install no optional fragment, even if one is detected.',
    vi: 'Không cài fragment tuỳ chọn nào, kể cả khi detect được.'
  },
  {
    name: 'stack', value: () => Object.keys(registry().aliases).join(' \\| '), kind: 'config',
    default: { en: 'none', vi: 'không có' },
    persisted: { en: `${PJ} → \`stack\` (expanded)`, vi: `${PJ} → \`stack\` (đã khai triển)` },
    en: 'Shortcut that sets every stack dimension; the options above override it.',
    vi: 'Lối tắt đặt mọi chiều của stack; các option ở trên ghi đè lên nó.'
  },
  {
    name: 'with-docs', value: null, kind: 'config',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: `${PJ} → \`optionalGroups\``, vi: `${PJ} → \`optionalGroups\`` },
    en: 'Also install the documentation checks (doc 09); updates keep them current.',
    vi: 'Cài thêm các kiểm tra tài liệu (tài liệu 09); bản cập nhật giữ chúng mới.'
  },
  {
    name: 'repo-owner', value: () => '@user \\| @org/team', kind: 'config',
    default: { en: 'none (required when there is no `CODEOWNERS`)', vi: 'không có (bắt buộc khi chưa có `CODEOWNERS`)' },
    persisted: { en: `${PJ} → \`repoOwner\`; \`CODEOWNERS\` standard block`, vi: `${PJ} → \`repoOwner\`; khối standard trong \`CODEOWNERS\`` },
    en: 'Owner of the project files (`CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/`).',
    vi: 'Owner của các file dự án (`CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/`).'
  },
  {
    name: 'carry-allow', value: () => '<rule>', repeat: true, split: false, kind: 'config',
    default: { en: 'none (decision required)', vi: 'không có (cần quyết định)' },
    persisted: { en: `${PJ} → \`permissions.allow\``, vi: `${PJ} → \`permissions.allow\`` },
    en: 'Keep this `allow` rule from an existing `settings.json` that the profile does not grant. Repeat for each rule. Rules that overlap a profile `ask` or `deny` are refused.',
    vi: 'Giữ rule `allow` này trong `settings.json` đang có mà profile không cấp. Lặp lại cho từng rule. Rule chồng lên `ask` hoặc `deny` của profile bị từ chối.'
  },
  {
    name: 'drop-allow', value: () => '<rule>', repeat: true, split: false, kind: 'config',
    default: { en: 'none (decision required)', vi: 'không có (cần quyết định)' },
    persisted: { en: 'not stored (the rule is dropped)', vi: 'không lưu (rule bị bỏ)' },
    en: 'Drop this `allow` rule instead. Repeat for each rule.',
    vi: 'Bỏ rule `allow` này. Lặp lại cho từng rule.'
  },
  {
    name: 'drop-allow-rest', value: null, kind: 'config',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: 'not stored (the rules are dropped)', vi: 'không lưu (các rule bị bỏ)' },
    en: 'Drop every `allow` rule not named with `--carry-allow` or `--drop-allow`.',
    vi: 'Bỏ mọi rule `allow` không được nêu bằng `--carry-allow` hoặc `--drop-allow`.'
  },
  {
    name: 'propose-unresolved', value: null, kind: 'run',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'For files that cannot be merged, write `<file>.proposed` and a checklist instead of stopping.',
    vi: 'Với file không gộp được, ghi `<file>.proposed` và một checklist thay vì dừng.'
  },
  {
    name: 'dry-run', value: null, kind: 'run',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'Show the plan, the value sources and the plan hash; write nothing.',
    vi: 'In plan, nguồn của từng giá trị và plan hash; không ghi gì.'
  },
  {
    name: 'yes', value: null, kind: 'run',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'Apply the plan reviewed with `--dry-run`; stop if it changed.',
    vi: 'Áp dụng plan đã xem bằng `--dry-run`; dừng nếu plan đã thay đổi.'
  },
  {
    name: 'plan', value: () => '<hash>', kind: 'run',
    default: { en: 'the plan recorded by `--dry-run`', vi: 'plan được `--dry-run` lưu lại' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'With `--yes`: require this plan hash.',
    vi: 'Dùng với `--yes`: yêu cầu đúng plan hash này.'
  },
  {
    name: 'allow-unreleased', value: null, kind: 'run',
    default: { en: 'off: `--yes` refuses a standard checkout that is dirty or not on its release tag', vi: 'tắt: `--yes` từ chối checkout standard chưa sạch hoặc không ở đúng tag release' },
    persisted: { en: 'not stored (printed in the output)', vi: 'không lưu (in ra trong output)' },
    en: 'For maintainers testing unreleased changes of the standard: run from a checkout that is not a clean release. Printed prominently in `--dry-run` and `--yes`.',
    vi: 'Cho maintainer thử thay đổi chưa release của standard: chạy từ checkout không phải bản release sạch. Được in rõ trong `--dry-run` và `--yes`.'
  },
  {
    name: 'target', value: () => '<dir>', kind: 'run',
    default: { en: 'current directory', vi: 'thư mục hiện tại' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'Repository to adopt.',
    vi: 'Repository cần áp dụng.'
  },
  {
    name: 'help', value: null, kind: 'run',
    default: { en: 'off', vi: 'tắt' },
    persisted: { en: 'not stored', vi: 'không lưu' },
    en: 'Print this list and exit.',
    vi: 'In danh sách này rồi thoát.'
  }
];

// Parses argv against OPTIONS. Returns { opts: { name: string | string[] | true }, given: Set, errors }.
export function parseArgs(argv) {
  const byName = new Map(OPTIONS.map((o) => [o.name, o]));
  const opts = {};
  const errors = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const o = arg.startsWith('--') ? byName.get(arg.slice(2)) : null;
    if (!o) {
      errors.push(`unknown option ${JSON.stringify(arg)} (see --help)`);
      continue;
    }
    if (o.value === null) {
      opts[o.name] = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
      errors.push(`--${o.name} needs a value: ${o.value().replace(/\\\|/g, '|')}`);
      continue;
    }
    i += 1;
    if (o.repeat) opts[o.name] = [...(opts[o.name] || []), ...(o.split === false ? [v] : v.split(',').map((x) => x.trim()).filter(Boolean))];
    else opts[o.name] = v;
  }
  return { opts, errors };
}

// The parsed options that decide a plan, for its hash: in the order of OPTIONS, repeated
// options sorted and without duplicates, so the order they are typed in does not matter.
// Leaves out the options that only control the run (dry-run, yes, plan, help) and
// --target (the hash has the resolved target directory).
const NOT_HASHED = new Set(['dry-run', 'yes', 'plan', 'help', 'target']);
export function canonicalFlags(opts) {
  return OPTIONS.filter((o) => !NOT_HASHED.has(o.name) && opts[o.name] !== undefined)
    .map((o) => [o.name, o.repeat ? [...new Set(opts[o.name])].sort() : opts[o.name]]);
}

const plain = (text) => text.replace(/`/g, '').replace(/\\\|/g, '|');
const syntax = (o) => `--${o.name}${o.value ? ` ${plain(o.value())}` : ''}`;

export function helpText() {
  const lines = [
    'Usage: node <path-to-standard>/scripts/adopt.mjs [options] --dry-run   review the plan',
    '       node <path-to-standard>/scripts/adopt.mjs [same options] --yes  apply exactly that plan',
    '',
    'Configuration choices are stored and reused: on a later run each value comes from a flag,',
    'then .claude/project.json, then detection, then the default.',
    ''
  ];
  for (const kind of ['config', 'run']) {
    lines.push(kind === 'config' ? 'Configuration (stored):' : 'Run control (never stored):');
    for (const o of OPTIONS.filter((x) => x.kind === kind)) {
      lines.push(`  ${syntax(o)}`, `      ${plain(o.en)}`, `      default: ${plain(o.default.en)}; stored in: ${plain(o.persisted.en)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// Markdown table for the README, in English or Vietnamese.
export function optionsTable(lang) {
  const head = lang === 'vi'
    ? ['Tuỳ chọn', 'Giá trị', 'Mặc định', 'Lưu ở', 'Mô tả']
    : ['Option', 'Values', 'Default', 'Persisted in', 'Description'];
  const rows = OPTIONS.map((o) => [`\`--${o.name}\``, o.value ? `\`${o.value()}\`` : '—', o.default[lang], o.persisted[lang], o[lang]]);
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}
