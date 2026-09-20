#!/usr/bin/env node
// Fails a build that lets the site's e-mail address into a served file as
// text — a page, an RSC payload, the feed, a bundle — so the guard a site
// puts up (EmailLink and tokens, src/lib/email.ts) cannot erode. The domain
// is the site's own (`site.url`'s host, from src/kit.ts) unless --domain
// names others; the documented place is the last step of `pnpm build`.
import "./lib/load-ts.mjs";
import { parseOrExit } from "./lib/args.mjs";
import { scanServed } from "./lib/guard-email.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["guard-email"], process.argv.slice(2));
const root = process.cwd();
let domains = flags.domain;
if (!domains.length) {
  const { kit } = await import("@/kit");
  domains = [new URL(kit.site.url).hostname.replace(/^www\./, "")];
}
const { scanned, hits } = scanServed(root, domains);
if (!scanned) { console.error("guard-email: no build under .next — run `pnpm build` first"); process.exit(2); }
if (flags.json) console.log(JSON.stringify({ domains, scanned, hits }, null, 1));
if (hits.length) {
  console.error(`guard-email: ${hits.length} served file(s) carry an address at ${domains.join(", ")} as text — render it through EmailLink and withEmailToken (agentic-cms/email):\n${hits.map((h) => `  ${h.file}: ${h.addresses.join(", ")}`).join("\n")}`);
  process.exit(1);
}
if (!flags.json) console.log(`guard-email: ${scanned} served files, no address at ${domains.join(", ")} as text`);
