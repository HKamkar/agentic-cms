#!/usr/bin/env node
// This machine's URLs for the dev server and the lab, found now and never
// written into the repo: localhost, the LAN addresses, the public address
// (a cloud VM's, reached where its firewall opens the port), whether each
// server answers, and whether ALLOWED_DEV_ORIGINS in .env.local covers
// every address a browser will open — a page from a host it lacks renders
// and never hydrates. `--write` adds the missing ones. The port is the -p
// of package.json's scripts.dev. lib/hosts.mjs does the work;
// docs/dev-server.md says which URL to hand over.
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { devPort, formatUrls, urlsReport } from "./lib/hosts.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS.urls, process.argv.slice(2));
const root = process.cwd();
const readScripts = () => { try { return JSON.parse(fs.readFileSync("package.json", "utf8")).scripts ?? {}; } catch { return {}; } };
const port = flags.port ?? devPort(readScripts());
if (!port) {
  console.error("urls: no dev port — package.json's scripts.dev runs no next dev here; pass --port");
  process.exit(2);
}

const report = await urlsReport({ root, port, labPort: flags["lab-port"], lookupPublic: !flags["no-public"], write: flags.write, fs });
if (flags.json) console.log(JSON.stringify(report, null, 1));
else console.log(formatUrls(report).join("\n"));
process.exit(report.origins.missing.length ? 1 : 0);
