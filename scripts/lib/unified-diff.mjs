// A line diff in the unified format that `git apply` and `patch` read, for
// `init --agent-files --diff` (the kit's change to an agent file since the
// site took it). The texts are a rule or a skill, a few hundred lines at
// most, so a plain longest-common-subsequence table is fast enough and the
// kit needs no diff dependency. A line keeps its newline, so a last line
// without one differs from the same line with one, as in `diff -u`.

const splitLines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

/** The edits that turn a into b, one op per line: " " kept, "-" removed, "+" added; a removal before the addition that replaces it. */
function editScript(a, b) {
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops = [];
  for (let i = 0, j = 0; i < a.length || j < b.length;) {
    if (i < a.length && j < b.length && a[i] === b[j]) { ops.push({ op: " ", line: a[i++] }); j++; }
    else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push({ op: "-", line: a[i++] });
    else ops.push({ op: "+", line: b[j++] });
  }
  return ops;
}

/** The changes grouped into hunks, as [first, end) op indices: two changes closer than twice the context share one. */
function changeRanges(ops, context) {
  const ranges = [];
  ops.forEach(({ op }, k) => {
    if (op === " ") return;
    const last = ranges.at(-1);
    if (last && k - last[1] <= 2 * context) last[1] = k + 1;
    else ranges.push([k, k + 1]);
  });
  return ranges;
}

const lineOut = ({ op, line }) => `${op}${line}${line.endsWith("\n") ? "" : "\n\\ No newline at end of file\n"}`;
/** A hunk header's side: its first line (1-based; the line before it when the side is empty) and its count, the count left out when 1. */
const side = (before, count) => `${count ? before + 1 : before}${count === 1 ? "" : `,${count}`}`;

/** The unified diff from `before` to `after` under the `--- from` / `+++ to` headers, with `context` lines around each change; "" when they are the same. */
export function unifiedDiff(before, after, { from = "a", to = "b", context = 3 } = {}) {
  const ops = editScript(splitLines(before), splitLines(after));
  const ranges = changeRanges(ops, context);
  if (!ranges.length) return "";
  const at = [];
  for (let k = 0, a = 0, b = 0; k <= ops.length; k++) { at.push([a, b]); if (ops[k]?.op !== "+") a++; if (ops[k]?.op !== "-") b++; }
  let text = `--- ${from}\n+++ ${to}\n`;
  for (const [first, end] of ranges) {
    const start = Math.max(0, first - context);
    const hunk = ops.slice(start, Math.min(ops.length, end + context));
    const [a, b] = at[start];
    text += `@@ -${side(a, hunk.filter((o) => o.op !== "+").length)} +${side(b, hunk.filter((o) => o.op !== "-").length)} @@\n${hunk.map(lineOut).join("")}`;
  }
  return text;
}
