// A preview: the site as a pull request has it, built with
// AGENTIC_CMS_PREVIEW=1 and uploaded at a link of its own (docs/preview.md),
// never the site. The engine reads the flag where it decides what a
// preview must not do: every page carries noindex and robots.txt disallows
// everything (`agentic-cms/seo`), the form endpoint delivers to the server's
// log instead of the site's destination (`agentic-cms/forms/server`). The
// build reads it from its environment, the Worker from the version's vars.

/** The environment variable that marks a preview build and a preview Worker. */
export const PREVIEW_ENV = "AGENTIC_CMS_PREVIEW";

/** Whether this build, or this request's Worker, is a preview: AGENTIC_CMS_PREVIEW is "1". */
export function isPreview(env: Record<string, string | undefined> = process.env): boolean {
  return env[PREVIEW_ENV] === "1";
}
