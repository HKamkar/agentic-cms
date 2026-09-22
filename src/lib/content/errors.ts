// Every content problem is a ContentError: the build prints its message and
// stops, and the message names the file, the field path and the problem the
// way FrontmatterError did ("content/blog/x.md: title is required"). One error
// carries every issue zod reported for that file, one self-contained line
// each, so an agent reading an interleaved build log can grep any line back
// to its cause.

export type ContentIssue = { path: string; problem: string };

// YAML's oldest trap for a writer: an unquoted scalar that contains ": "
// is a mapping, so a sentence with a colon becomes a key. The schema sees
// an object where text belongs; the parser, when the line is already
// inside a mapping, refuses it as a nested mapping. Both say so with the
// same fix, because both are the same mistake.
export const COLON_FIX = 'a line that contains ": " is read as a key — quote the text';

/** The text a colon-trapped mapping was written as ({ "A note": "of two halves" } → `A note: of two halves`), or null when the value is not one. */
export function trappedLine(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1) return null;
  const tail = (value as Record<string, unknown>)[keys[0]];
  if (tail !== null && !["string", "number", "boolean"].includes(typeof tail)) return null;
  const line = `${keys[0]}: ${tail ?? ""}`.trim();
  return line.length > 72 ? `${line.slice(0, 69).replace(/\s+\S*$/, "")}…` : line;
}

/** The problem for a field that expects text and received a mapping (or a list of them), naming the trap and the fix; null when the value is neither. */
export function colonTrap(value: unknown): string | null {
  const list = Array.isArray(value) ? value : null;
  const mappings = list ?? [value];
  if (!mappings.length || !mappings.every((v) => typeof v === "object" && v !== null && !Array.isArray(v))) return null;
  const quoted = trappedLine(mappings[0]);
  const what = `is a ${list ? "list of mappings" : "mapping"}, not text`;
  return quoted ? `${what}: the line contains ": ", which YAML reads as a key — quote it ("${quoted}")` : `${what}: ${COLON_FIX}`;
}

const line = (file: string, issue: ContentIssue) => `${file}: ${issue.path ? `${issue.path} ` : ""}${issue.problem}`;

export class ContentError extends Error {
  readonly file: string;
  /** "" for the file itself, else "title", "related[1]", "[2].quote", "h-kamkar.name", "items[0].question". */
  readonly path: string;
  readonly problem: string;
  /** Every issue of that file; the first is `path` / `problem`. */
  readonly issues: readonly ContentIssue[];

  constructor(file: string, path: string, problem: string, more: readonly ContentIssue[] = []) {
    const issues = [{ path, problem }, ...more];
    super(issues.map((issue) => line(file, issue)).join("\n"));
    this.name = "ContentError";
    this.file = file;
    this.path = path;
    this.problem = problem;
    this.issues = issues;
  }
}

/** zod's path segments as one field path: ["related", 1] → "related[1]", [2, "quote"] → "[2].quote". */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((out, segment) => {
    if (typeof segment === "number") return `${out}[${segment}]`;
    return out ? `${out}.${String(segment)}` : String(segment);
  }, "");
}
