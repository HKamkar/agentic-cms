// Every content problem is a ContentError: the build prints its message and
// stops, and the message names the file, the field path and the problem the
// way FrontmatterError did ("content/blog/x.md: title is required"). One error
// carries every issue zod reported for that file, one self-contained line
// each, so an agent reading an interleaved build log can grep any line back
// to its cause.

export type ContentIssue = { path: string; problem: string };

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
