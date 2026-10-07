// Unified diff of two texts, for the adoption dry run. No dependencies.
// Line-based LCS; the files it compares are small (CLAUDE.md, settings, templates).
const CONTEXT = 3;

export function unifiedDiff(before, after, path) {
  if (before === after) return '';
  const a = before === null ? [] : before.split('\n');
  const b = after.split('\n');
  if (a.length && a[a.length - 1] === '') a.pop();
  if (b.length && b[b.length - 1] === '') b.pop();

  // LCS table, then walk it to a list of operations
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { ops.push({ t: ' ', s: a[i], i, j }); i += 1; j += 1; }
    else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) { ops.push({ t: '-', s: a[i], i, j }); i += 1; }
    else { ops.push({ t: '+', s: b[j], i, j }); j += 1; }
  }

  // Group changes into hunks with context
  const changed = ops.map((o, k) => (o.t === ' ' ? -1 : k)).filter((k) => k > -1);
  const hunks = [];
  for (const k of changed) {
    const last = hunks[hunks.length - 1];
    if (last && k - last.end <= CONTEXT * 2) last.end = k;
    else hunks.push({ start: k, end: k });
  }
  const out = [`--- ${before === null ? '/dev/null' : `a/${path}`}`, `+++ b/${path}`];
  for (const h of hunks) {
    const from = Math.max(0, h.start - CONTEXT);
    const to = Math.min(ops.length - 1, h.end + CONTEXT);
    const slice = ops.slice(from, to + 1);
    const aLen = slice.filter((o) => o.t !== '+').length;
    const bLen = slice.filter((o) => o.t !== '-').length;
    const aStart = aLen ? slice.find((o) => o.t !== '+').i + 1 : slice[0].i;
    const bStart = bLen ? slice.find((o) => o.t !== '-').j + 1 : slice[0].j;
    out.push(`@@ -${aStart},${aLen} +${bStart},${bLen} @@`);
    for (const o of slice) out.push(`${o.t}${o.s}`);
  }
  return `${out.join('\n')}\n`;
}
