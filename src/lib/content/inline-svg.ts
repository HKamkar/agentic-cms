// An SVG of the site's own, read for a section to put inline — an animated
// loop whose clock the page runs (agentic-cms/ix InlineAnimation), a drawing
// that follows the page's colours — at build time, in a section registry's
// resolve or a server component. Pages are prerendered, so this runs when a
// page is built, never at request time; on a standalone host the file stays
// in public/, which `agentic-cms assemble` copies into the package whatever
// the file trace did with it.
import { namespaceIds, svgMarkup } from "../svg.ts";
import { readTrustedSvg } from "../svg-read.ts";

/**
 * The markup of an SVG the site's repository owns (a path under `root`, the site's root by default, outside
 * node_modules), ready for dangerouslySetInnerHTML: the prolog and comments dropped, and every id prefixed with
 * `prefix` — references followed — so two drawings on one page never resolve each other's masks, gradients or <use>
 * targets. Throws on a path outside the site and on markup that carries code (a script, an event handler, a
 * javascript: URL).
 */
export function readInlineSvg(file: string, { prefix, root = process.cwd() }: { prefix: string; root?: string }): string {
  return namespaceIds(svgMarkup(readTrustedSvg(root, file)).trim(), prefix);
}
