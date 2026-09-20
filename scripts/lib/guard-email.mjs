// The scan behind `agentic-cms guard-email`: every file a Next build serves —
// the prerendered pages and their RSC payloads under .next/server/app, the
// non-HTML routes (feed, sitemap, robots as .body), the static chunks — read
// as text and searched for an address at the site's domain. A site that
// renders its address through EmailLink and tokens passes; one that let the
// address into a page, a payload or a bundle is named file by file.
import fs from "node:fs";
import path from "node:path";

const SERVED = /\.(html|rsc|body|txt|js|json|xml)$/;
const DIRS = [".next/server/app", ".next/static"];

/** One pattern for every address at any of the domains, every dot escaped. */
export const domainPattern = (domains) => new RegExp(`[A-Za-z0-9._%+-]+@(?:${domains.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9.-])`, "g");

const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);

/** { scanned, hits: [{ file, addresses }] } over the served files under root. */
export function scanServed(root, domains) {
  const pattern = domainPattern(domains);
  const hits = [];
  let scanned = 0;
  for (const dir of DIRS) {
    for (const file of walk(path.join(root, dir)).filter((f) => SERVED.test(f)).sort()) {
      scanned++;
      const addresses = [...new Set(fs.readFileSync(file, "utf8").match(pattern) ?? [])].sort();
      if (addresses.length) hits.push({ file: path.relative(root, file).split(path.sep).join("/"), addresses });
    }
  }
  return { scanned, hits: hits.sort((a, b) => a.file.localeCompare(b.file)) };
}
