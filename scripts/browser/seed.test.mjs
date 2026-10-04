// A visitor's choice seeded into the page's storage (scripts/lib/storage-seed.mjs) on the fixture site's
// banner page: the record is there before the first inline <head> script reads it, a capture records the
// template and seeds a --ref-like second run alike, a compare refuses two seeds unless asked and then shows
// the difference where the banner is and nowhere else, the site's src/config/harness.ts is the default and
// --no-storage drops it, shot, probe, sheet and the icon audit are seeded like a capture, and the audit
// leaves a demo route out unless it is named.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromePath, launch, serveStatic } from "../lib/browser.mjs";
import { resolveSeed } from "../lib/storage-seed.mjs";
import { BANNER, CONSENT_PAGE, addPage, fixtureSite } from "../fixtures/site.mjs";

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const run = (root, args) => spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: "utf8" });
const CONSENT = '{"analytics":"denied","at":"{now}","version":1}';
const bannerSite = () => { const root = fixtureSite(); addPage(root, "/consent", CONSENT_PAGE); return root; };
const meta = (root, label) => JSON.parse(fs.readFileSync(path.join(root, ".parity/visual", label, "meta.json"), "utf8"));
const capture = (root, label, ...args) => { const r = run(root, ["visual-parity", "capture", label, "--pages", "/consent", "--widths", "800", ...args]); assert.equal(r.status, 0, r.stderr); return r; };
const writeSiteSeed = (root, body) => { fs.mkdirSync(path.join(root, "src/config"), { recursive: true }); fs.writeFileSync(path.join(root, "src/config/harness.ts"), body); };

test("the seed is in both storage areas before the page's first inline <head> script runs, {now} replaced; unseeded, it finds nothing", { skip }, async () => {
  const root = bannerSite();
  const server = await serveStatic({ root });
  const now = new Date("2026-10-02T12:00:00.000Z");
  try {
    for (const [seed, expected] of [
      [await resolveSeed({ storage: [`consent=${CONSENT}`], "session-storage": ["tab=2"] }, { root, now }), { consent: CONSENT.replace("{now}", now.toISOString()), tab: "2" }],
      [null, { consent: null, tab: null }],
    ]) {
      const { context, close } = await launch({ seed, width: 800 });
      try {
        const page = await context.newPage();
        await page.goto(`${server.url}/consent`, { waitUntil: "load" });
        assert.deepEqual(await page.evaluate(() => window.__seenAtHead), expected);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.banner ?? null), seed ? null : "shown");
        // the page writes its own record; the next document of the run starts from the seed again
        await page.evaluate(() => localStorage.setItem("consent", "changed by the page"));
        await page.goto(`${server.url}/consent`, { waitUntil: "load" });
        assert.equal(await page.evaluate(() => window.__seenAtHead.consent), seed ? expected.consent : "changed by the page");
      } finally { await close(); }
    }
  } finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("a seeded capture records the template; a compare refuses two seeds, shows with --mixed-seed only the banner's rows, and two runs of one seed agree", { skip }, () => {
  const root = bannerSite();
  try {
    capture(root, "plain");
    const seeded = capture(root, "seeded", "--storage", `consent=${CONSENT}`);
    assert.match(seeded.stdout, /seed: storage consent=\{"analytics":"denied","at":"\{now\}","version":1\}/);
    assert.equal(meta(root, "plain").seed, undefined, "an unseeded capture records no seed");
    const record = meta(root, "seeded").seed;
    assert.deepEqual(record.storage, { consent: CONSENT }, "the template, {now} as written");
    assert.match(record.at, /^\d{4}-\d\d-\d\dT/);

    const refused = run(root, ["visual-parity", "compare", "plain", "seeded"]);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /plain was seeded with no seed and seeded with storage consent=.*: compare captures seeded alike — recapture plain .*--mixed-seed/);

    const mixed = run(root, ["visual-parity", "compare", "plain", "seeded", "--mixed-seed", "--json"]);
    assert.equal(mixed.status, 1, mixed.stderr);
    const report = JSON.parse(mixed.stdout);
    assert.deepEqual(report.seed, { before: null, after: record });
    const shot = report.files.find((f) => f.name === "consent@800.png");
    assert.equal(shot.status, "CHANGED");
    const rows = shot.bands.reduce((sum, [from, to]) => sum + to - from + 1, 0);
    assert.ok(rows <= BANNER.height && shot.changedPixels <= BANNER.width * BANNER.height, `only the banner differs: ${rows} rows, ${shot.changedPixels} px`);
    assert.equal(report.files.filter((f) => f.status !== "ok").length, 1, "the section geometry agrees");

    const again = capture(root, "again", "--storage", `consent=${CONSENT}`);
    assert.notEqual(meta(root, "again").seed.at, record.at, "a later run: another {now}, the same template");
    const alike = run(root, ["visual-parity", "compare", "seeded", "again"]);
    assert.equal(alike.status, 0, alike.stdout + alike.stderr);
    assert.match(alike.stdout, /seed: storage consent=.*, on both/);
    assert.match(again.stdout, /seed: storage consent=/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the site's src/config/harness.ts seeds every capture as the flag would; --no-storage drops it; a broken one exits 2 naming it", { skip }, () => {
  const root = bannerSite();
  try {
    capture(root, "flag", "--storage", `consent=${CONSENT}`);
    writeSiteSeed(root, `// the record a visitor's choice leaves\nexport const harness = { storage: { consent: { analytics: "denied", at: "{now}", version: 1 } } };\n`);
    capture(root, "site");
    assert.deepEqual(meta(root, "site").seed.storage, { consent: CONSENT });
    assert.equal(run(root, ["visual-parity", "compare", "flag", "site"]).status, 0, "the site's default and the flag are one seed");
    capture(root, "first-visit", "--no-storage");
    assert.equal(meta(root, "first-visit").seed, undefined);
    assert.equal(run(root, ["visual-parity", "compare", "first-visit", "site", "--mixed-seed"]).status, 1, "the banner, back on a first visit");
    writeSiteSeed(root, `export const harness = { localStorage: {} };\n`);
    const broken = run(root, ["visual-parity", "capture", "x", "--pages", "/consent"]);
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /visual-parity capture: src\/config\/harness\.ts: harness\.localStorage is not a setting/);
    const pair = run(root, ["shot", "/consent", "--no-storage", "--storage", "consent"]);
    assert.equal(pair.status, 2);
    assert.match(pair.stderr, /shot: --storage takes <key>=<value>, not consent/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("probe, shot and sheet are seeded like a capture and say so in their JSON; --no-storage shows the first visit", { skip }, () => {
  const root = bannerSite();
  try {
    writeSiteSeed(root, `export const harness = { storage: { consent: ${JSON.stringify(CONSENT)} }, sessionStorage: { tab: "2" } };\n`);
    const probe = (...args) => { const r = run(root, ["probe", "/consent", "--select", ".banner", "--props", "display", ...args]); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
    const seeded = probe();
    assert.deepEqual(seeded.seed.storage, { consent: CONSENT });
    assert.deepEqual(seeded.seed.sessionStorage, { tab: "2" });
    assert.equal(seeded.elements[0].computed.display, "none");
    const first = probe("--no-storage");
    assert.equal(first.seed, null);
    assert.equal(first.elements[0].computed.display, "block");
    const shot = run(root, ["shot", "/consent", "--json", "--no-storage", "--session-storage", "tab=3"]);
    assert.equal(shot.status, 0, shot.stderr);
    assert.deepEqual(JSON.parse(shot.stdout).seed.sessionStorage, { tab: "3" });
    assert.deepEqual(JSON.parse(shot.stdout).seed.storage, {});
    fs.writeFileSync(path.join(root, "disc.yaml"), `name: disc\nrows:\n  - label: one\n    size: 24\n    cells:\n      - { label: disc, svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>' }\n`);
    const sheet = run(root, ["sheet", "disc.yaml", "--json"]);
    assert.equal(sheet.status, 0, sheet.stderr);
    assert.deepEqual(JSON.parse(sheet.stdout).seed.storage, { consent: CONSENT });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("icons audit inventories the pages after the choice: the seed hides the banner's icon, a first visit counts it; a demo route only when named", { skip }, () => {
  const root = bannerSite();
  addPage(root, "/hero-demo", CONSENT_PAGE);
  const audit = (...args) => { const r = run(root, ["icons", "audit", "--json", ...args]); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  const on = (report, page) => report.icons.filter((icon) => icon.page === page);
  try {
    const seeded = audit("--storage", `consent=${CONSENT}`);
    assert.ok(seeded.pages.includes("/consent") && !seeded.pages.includes("/hero-demo"), seeded.pages.join(" "));
    assert.deepEqual(on(seeded, "/consent"), [], "the banner is closed, its icon not an icon of the page");
    assert.deepEqual(seeded.seed.storage, { consent: CONSENT });
    const first = audit("--pages", "/consent,/hero-demo");
    assert.equal(first.seed, null);
    assert.equal(on(first, "/consent").length, 1, "a first visit: the banner's close icon");
    assert.equal(on(first, "/hero-demo").length, 1, "a demo route, named");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
