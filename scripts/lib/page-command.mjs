// What shot and probe share: the served site or the build, the browser, the
// page prepared like the harness prepares one, the target found by selector
// or heading, the names of things. A command calls openTarget() and works on
// the page it gets back.
import path from "node:path";
import { collectConsole, findTarget, launch, prepare, resolveTarget, serveStatic } from "./browser.mjs";

/** "/" → "home", "/blog/x" → "blog__x", a URL → its path the same way. */
export function routeName(target) {
  const route = /^https?:\/\//.test(target) ? new URL(target).pathname : target;
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, "__") || "home";
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Opens the target in a prepared page; returns what a command needs and a close() for the end. */
export async function openTarget(target, flags) {
  const root = process.cwd();
  const server = flags.url ? null : await serveStatic({ root });
  const base = flags.url ?? server.url;
  const url = resolveTarget(target, { base });
  const { context, close: closeBrowser } = await launch({ scheme: flags.scheme, motion: flags.motion, width: flags.width, height: flags.height, scale: flags.scale ?? 1 });
  const page = await context.newPage();
  const consoleLines = collectConsole(page);
  await page.goto(url, { waitUntil: "load" });
  await prepare(page, { motion: flags.motion });
  if (flags.scroll && flags.scroll !== "into-view") await page.evaluate((y) => window.scrollTo(0, y), Number(flags.scroll));
  const locator = findTarget(page, flags);
  if (locator && (flags.scroll === "into-view" || (flags.motion && !flags.scroll))) await locator.nth(flags.index).scrollIntoViewIfNeeded().catch(() => {});
  if (flags.wait) await page.waitForTimeout(flags.wait);
  const close = async () => { await closeBrowser(); server?.close(); };
  return { root, url, route: /^https?:\/\//.test(target) ? new URL(target).pathname : target, page, locator, consoleLines, close };
}

/** The "by" and "value" of a target, for the JSON and the file name. */
export const targetOf = (flags) => (flags.select ? { by: "select", value: flags.select } : flags.heading ? { by: "heading", value: flags.heading } : null);

/** Exits 1 naming the selector or heading when nothing matched. */
export async function requireMatch(locator, flags, route) {
  const count = await locator.count();
  if (count > flags.index) return count;
  const what = flags.select ?? `a heading matching /${flags.heading}/`;
  console.error(`${what}: no element matches on ${route}${count ? ` (only ${count} match${count === 1 ? "" : "es"}; --index ${flags.index} is out of range)` : ""}`);
  process.exit(1);
}

export const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
