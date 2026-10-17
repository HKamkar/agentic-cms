#!/usr/bin/env node
// The dev server and the lab for the owner's devices, started — or found
// running — with every URL to hand over printed once each route answers:
// the origins checked first (--write-origins adds the missing ones), next
// dev on the site's port on every interface, the lab when .parity/lab has
// scenes (or --lab), every *-demo route and the root asked until it answers,
// one table of localhost, LAN and public × the routes and the lab's pages,
// a stale Turbopack cache caught in the log (--fix-cache clears it and
// restarts), and Ctrl-C stopping what serve started. lib/serve.mjs is the
// plan and the run; docs/dev-server.md the guide. The lab's modules are the
// package's (TypeScript in this checkout), so the loader hook comes first.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { profileOrExit } from "./lib/profile.mjs";
import { SPECS } from "./lib/specs.mjs";

const { listScenes } = await import("./lib/lab.mjs");
const { startLabServer } = await import("./lib/lab-server.mjs");
const { ServeError, formatServe, nextDev, servePlan, startServe } = await import("./lib/serve.mjs");
const { nextBin } = await import("./lib/dev-server.mjs");

const { flags } = parseOrExit(SPECS.serve, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`serve: ${message}`); process.exit(code); };
const readScripts = () => { try { return JSON.parse(fs.readFileSync("package.json", "utf8")).scripts ?? {}; } catch { return {}; } };

let plan;
try { plan = servePlan({ root, flags, scripts: readScripts(), scenes: [...listScenes(root).keys()] }); } catch (error) { if (error instanceof ServeError) fail(error.message); throw error; }
// the lab's grounds are the site's schemes (src/config/harness.ts), as lab serve shows them
const schemes = (await profileOrExit("serve"))?.schemes;
// With --json, stdout carries the reports alone (one JSON document per line); the progress goes to stderr.
const say = flags.json ? console.error : console.log;
const print = (report) => (flags.json ? console.log(JSON.stringify(report)) : console.log(formatServe(report).join("\n")));

// next dev runs in its own process group (serve stops it whole, and restarts it for --fix-cache), so a Ctrl-C in
// the terminal does not reach it: serve passes it on, at any point, the start included.
let stop = async () => {};
let stopping = false;
const quit = (code) => async () => { if (stopping) return; stopping = true; await stop(); process.exit(code); };
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, quit(0));

say(`serve: starting next dev on port ${plan.port}${plan.lab ? ` and the lab on ${plan.labPort}` : ""}, then asking ${plan.routes.join(", ")} until each answers`);
let run;
try {
  // next is needed only to start a server: this site's own, already running, is reused without it
  const start = nextBin(root) ? nextDev({ root, timeout: plan.timeout }) : () => Promise.reject(new ServeError("next is not installed here: pnpm install (or bash scripts/setup.sh) first"));
  run = await startServe({ root, plan, fs, schemes, start, startLab: startLabServer, log: say, onReport: print, track: (fn) => { stop = fn; } });
} catch (error) {
  await stop();
  fail(error.message, error instanceof ServeError ? 2 : 1);
}
print(run.report);
const ended = await run.done;
console.error(`serve: ${ended.message}`);
await quit(ended.code)();
