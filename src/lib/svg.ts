// The string work on an SVG that is put inline in a page, shared by the lab
// (its scenes, studies and sheets) and a site's own sections: the markup
// without its prolog and comments, its root tagged, and its ids made its own.
// No file system and no React, so a client bundle, a server component and
// the kit's scripts can all import it.

/** An SVG file's text as inline markup: the XML prolog and the comments dropped. */
export const svgMarkup = (text: string): string => text.replace(/^<\?xml[^>]*>\s*/, "").replace(/<!--[\s\S]*?-->\s*/g, "");

/** The root <svg> of a scene's markup tagged with a class (and sized, when asked), so a page can address it. */
export function tagRoot(markup: string, className: string, size?: { width: number; height: number }): string {
  const root = markup.match(/<svg\b[^>]*>/)?.[0];
  if (!root) throw new Error("not an SVG: no <svg> root");
  let tagged = /\sclass="/.test(root) ? root.replace(/\sclass="/, ` class="${className} `) : root.replace(/^<svg\b/, `<svg class="${className}"`);
  if (size) tagged = tagged.replace(/\s(width|height)="[^"]*"/g, "").replace(/^<svg\b/, `<svg width="${size.width}" height="${size.height}"`);
  return markup.replace(root, tagged);
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A copy of a scene whose ids are its own: every id becomes `<prefix>-<id>`, and every reference follows — url(#…), href and xlink:href "#…", a SMIL begin/end on an element, an ARIA id list, a #… selector in its styles — so copies of one scene on one page never resolve each other's masks, clip paths, gradients or <use> targets. */
export function namespaceIds(markup: string, prefix: string): string {
  const ids = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return markup;
  const name = (id: string) => (ids.has(id) ? `${prefix}-${id}` : id);
  const syncbase = new RegExp(`(^|[;\\s])(${[...ids].map(escapeRe).join("|")})\\.(?=begin|end|repeat|click|mouse|focus|activate)`, "g");
  return markup
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, (block) => block.replace(/#([A-Za-z_][\w-]*)/g, (m, id) => (ids.has(id) ? `#${name(id)}` : m)))
    .replace(/(\sid=")([^"]+)"/g, (m, head, id) => `${head}${name(id)}"`)
    .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, quote, id) => `url(${quote}#${name(id)}${quote})`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, (m, head, id) => `${head}#${name(id)}"`)
    .replace(/(\s(?:begin|end)=")([^"]*)"/g, (m, head, value) => `${head}${value.replace(syncbase, (s: string, lead: string, id: string) => `${lead}${name(id)}.`)}"`)
    .replace(/(\saria-(?:labelledby|describedby)=")([^"]*)"/g, (m, head, list) => `${head}${list.split(/\s+/).map(name).join(" ")}"`);
}
