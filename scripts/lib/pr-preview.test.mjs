// The preview of a pull request with a stubbed wrangler: the alias pr-<n>
// and the preview var it is given, the URL read from its output file, the
// comment's text for each kind of change, the pages a change touches, the
// one comment updated on the next push, and the runs that make no preview
// — a fork's pull request, a run without the secrets — saying so.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { changedFiles, checkCloudflare, MARKER, NOINDEX_HEADERS, noPreviewReason, PreviewError, previewComment, prPreview, pullRequestOf, touchedPages, upsertComment, uploadVersion } from "./pr-preview.mjs";

const URL_OF = "https://pr-12-site.team.workers.dev";
const SECRETS = { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" };
const page = (route, extra = "") => `seo:\n  path: ${route}\nsections:\n  - type: hero\n${extra}`;

/** A site tree on disk: `files` by path, with what a preview needs (the adapter, a Wrangler config, OpenNext's assets folder) unless `bare`. */
function siteTree(files = {}, { bare = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-preview-"));
  const all = { ...(bare ? {} : { "node_modules/@opennextjs/cloudflare/package.json": "{}", "wrangler.jsonc": "{}", ".open-next/assets/BUILD_ID": "x" }), "src/config/site.ts": 'export const site = {\n  postPrefix: "/news",\n};\n', ...files };
  for (const [file, text] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

/** The shell: git answers the diff with `changed`, and wrangler (behind OpenNext's upload) writes its output file as the real one does. */
function stubShell({ changed = [], preview = { preview_alias_url: URL_OF, preview_url: "https://abcd1234-site.team.workers.dev" }, uploadFails = false } = {}) {
  const calls = [];
  const run = (command, args, { env = {} } = {}) => {
    calls.push({ command, args, env });
    if (command === "git" && args[0] === "diff") return { status: 0, stdout: changed.join("\n"), stderr: "" };
    if (command === "git") return { status: 128, stdout: "", stderr: "" };
    if (args.includes("upload")) {
      if (uploadFails) return { status: 1, stdout: "", stderr: "Authentication error [code: 10000]" };
      fs.appendFileSync(env.WRANGLER_OUTPUT_FILE_PATH, `${JSON.stringify({ type: "wrangler-session", version: 1 })}\n${JSON.stringify({ type: "version-upload", version: 1, worker_name: "site", version_id: "v-1", ...preview })}\n`);
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return Object.assign(run, { calls });
}

/** GitHub's issue comments in memory, behind the calls upsertComment() makes. */
function stubGithub(comments = []) {
  const calls = [];
  const github = async (method, route, body) => {
    calls.push(`${method} ${route}`);
    if (method === "GET") return comments;
    if (method === "PATCH") { const id = Number(route.split("/").at(-1)); comments.find((c) => c.id === id).body = body.body; return {}; }
    comments.push({ id: comments.length + 100, body: body.body });
    return {};
  };
  return Object.assign(github, { calls, comments });
}

const eventFile = (root, { fork = false, number = 12 } = {}) => {
  const file = path.join(root, "event.json");
  fs.writeFileSync(file, JSON.stringify({ pull_request: { number, head: { sha: "abcdef1234567890", repo: { full_name: fork ? "someone/site" : "owner/site" } } } }));
  return { GITHUB_EVENT_PATH: file, GITHUB_REPOSITORY: "owner/site", GITHUB_BASE_REF: "develop", RUNNER_TEMP: root };
};

test("the stubbed wrangler gets the alias pr-<n> and the preview var through OpenNext's upload, and its output file names the URL", () => {
  const root = siteTree();
  const run = stubShell();
  const outputFile = path.join(root, "out.json");
  fs.writeFileSync(outputFile, `${JSON.stringify({ type: "version-upload", preview_alias_url: "https://stale.example" })}\n`);
  assert.deepEqual(uploadVersion({ alias: "pr-12", outputFile, run, fs }), { url: URL_OF, version: "v-1" }, "a file a run before left is not read");
  const [upload] = run.calls;
  assert.deepEqual([upload.command, ...upload.args], ["pnpm", "exec", "opennextjs-cloudflare", "upload", "--preview-alias", "pr-12", "--var", "AGENTIC_CMS_PREVIEW:1"]);
  assert.equal(upload.env.WRANGLER_OUTPUT_FILE_PATH, outputFile);
  assert.throws(() => uploadVersion({ alias: "pr-12", outputFile, run: stubShell({ preview: {} }), fs }), /named no preview URL: turn on the Worker's preview URLs/);
  assert.throws(() => uploadVersion({ alias: "pr-12", outputFile, run: stubShell({ uploadFails: true }), fs }), (error) => error instanceof PreviewError && /upload answered 1: Authentication error/.test(error.message));
  fs.rmSync(root, { recursive: true });
});

test("the comment: the marker, the link at the push it shows, what a preview is not, and the pages, each a link while the preview has it", () => {
  const touched = { every: null, pages: [{ route: "/", file: "content/pages/home.yaml", state: "changed" }, { route: "/news/x", file: "content/blog/x.md", state: "draft" }, { route: "/old", file: "content/pages/old.yaml", state: "removed" }] };
  assert.equal(previewComment({ url: URL_OF, sha: "abcdef1234", touched }), [
    MARKER,
    "### Preview",
    "",
    `**${URL_OF}** shows this pull request at \`abcdef1\`: every page as a production build makes it, never indexed, its forms delivered to a log, no analytics tag. The link stays the same on every push.`,
    "",
    "The pages the change touches:",
    "",
    `- [\`/\`](${URL_OF}/) (\`content/pages/home.yaml\`)`,
    "- `/news/x` — a draft, which the preview leaves out as production does (`content/blog/x.md`)",
    "- `/old` — removed (`content/pages/old.yaml`)",
    "",
  ].join("\n"));
  const every = previewComment({ url: URL_OF, sha: "abcdef1", touched: { every: ["src/a.tsx", "src/b.tsx", "src/c.tsx", "src/d.tsx", "src/e.tsx", "src/f.tsx"], pages: [] } });
  assert.match(every, /\nEvery page: the change reaches the chrome, a component, the config or a collection more than one page reads \(`src\/a\.tsx`, `src\/b\.tsx`, `src\/c\.tsx`, `src\/d\.tsx`, `src\/e\.tsx`, and 1 more\)\.\n$/);
  assert.match(previewComment({ url: URL_OF, sha: "abcdef1", touched: { every: null, pages: [] } }), /\nNo page: the change touches nothing a page is built from\.\n$/);
  assert.match(previewComment({ url: URL_OF, sha: "abcdef1", touched: null }), /could not be listed against its base \(a shallow checkout/);
});

test("touchedPages: a page by its route, a post (a draft, a removed one), an FAQ set by the pages that name it, pictures by what they are named for; the docs none; the chrome every page", () => {
  const root = siteTree({ "content/pages/home.yaml": page("/"), "content/pages/about.yaml": page("/sections/about", "  - type: group\n    sections:\n      - type: faq\n        set: general\n"), "content/blog/x.md": "---\ntitle: X\n---\n", "content/blog/draft.md": "---\ntitle: D\ndraft: true\n---\n" });
  const files = ["content/pages/about.yaml", "content/blog/draft.md", "content/blog/gone.md", "content/pages/old.yaml", "content/faqs/general.yaml", "public/images/blog/x/x-hero.webp", "public/images/home-og.jpg", "docs/x.md", "README.md", "content/_schemas/pages.json", "content/redirects.yaml", "src/kit.test.ts"];
  const touched = touchedPages(root, files, { fs, show: (file) => (file === "content/pages/old.yaml" ? page("/old") : null) });
  assert.equal(touched.every, null);
  assert.deepEqual(touched.pages.map(({ route, state }) => `${route} ${state}`), ["/ changed", "/news/draft draft", "/news/gone removed", "/news/x changed", "/old removed", "/sections/about changed"]);
  assert.deepEqual(touchedPages(root, ["src/components/ui/Button.tsx", "content/reviews.yaml", "public/images/ui/icon.svg", "content/pages/home.yaml"], { fs }), { every: ["src/components/ui/Button.tsx", "content/reviews.yaml", "public/images/ui/icon.svg"], pages: [{ route: "/", file: "content/pages/home.yaml", state: "changed" }] });
  fs.rmSync(root, { recursive: true });
});

test("the pull request from GitHub's event or --pr; a fork's makes no preview, nor one without the secrets, and each says why", () => {
  const root = siteTree();
  const env = eventFile(root);
  assert.deepEqual(pullRequestOf({ env, fs, flags: {}, run: stubShell() }), { pr: 12, base: "origin/develop", sha: "abcdef1234567890", fork: false, repo: "owner/site" });
  assert.equal(pullRequestOf({ env, fs, flags: { pr: 7, base: "main" }, run: stubShell() }).pr, 7);
  assert.throws(() => pullRequestOf({ env: {}, fs, flags: {}, run: stubShell() }), (error) => error.usage && /no pull request: run it in a pull_request workflow, or name one with --pr <n>/.test(error.message));
  assert.match(noPreviewReason({ fork: true }, SECRETS), /^a pull request from a fork has no secrets, so this run made no preview/);
  assert.match(noPreviewReason({ fork: false }, { CLOUDFLARE_ACCOUNT_ID: "a" }), /^CLOUDFLARE_API_TOKEN is not set, so this run made no preview: the site owner adds it as the repository's secrets/);
  assert.equal(noPreviewReason({ fork: false }, SECRETS), null);
  fs.rmSync(root, { recursive: true });
});

test("prPreview: a fork's run and a run without secrets build nothing; with them, the build with the flag, the noindex headers, the upload, and one comment updated on the next push", async () => {
  const root = siteTree({ "content/pages/home.yaml": page("/"), ".open-next/assets/_headers": "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n" });
  const forked = stubShell();
  assert.deepEqual(await prPreview({ root, env: { ...eventFile(root, { fork: true }), ...SECRETS }, flags: {}, fs, run: forked, github: stubGithub() }), { status: "skipped", pr: 12, reason: noPreviewReason({ fork: true }, SECRETS) });
  assert.equal((await prPreview({ root, env: eventFile(root), flags: {}, fs, run: forked, github: stubGithub() })).status, "skipped");
  assert.deepEqual(forked.calls, [], "nothing run: no build for a run that makes no preview");
  const run = stubShell({ changed: ["content/pages/home.yaml"] });
  const github = stubGithub([{ id: 1, body: "a review" }]);
  const env = { ...eventFile(root), ...SECRETS };
  const first = await prPreview({ root, env, flags: {}, fs, run, github });
  assert.deepEqual([first.status, first.alias, first.url, first.comment], ["previewed", "pr-12", URL_OF, "created"]);
  const build = run.calls.find((call) => call.args.includes("build"));
  assert.deepEqual(build.env, { AGENTIC_CMS_PREVIEW: "1", AGENTIC_CMS_PLACEHOLDERS: "warn" }, "built as production with the flag, its placeholders warnings as in CI");
  const headers = fs.readFileSync(path.join(root, ".open-next/assets/_headers"), "utf8");
  assert.ok(headers.startsWith(NOINDEX_HEADERS) && headers.includes("Cache-Control"), "the rule first, OpenNext's own kept");
  assert.match(github.comments[1].body, /\[`\/`\]\(https:\/\/pr-12-site\.team\.workers\.dev\/\)/);
  const second = await prPreview({ root, env, flags: { build: false }, fs, run, github });
  assert.equal(second.comment, "updated");
  assert.equal(github.comments.length, 2, "the next push updates the one comment");
  assert.equal(fs.readFileSync(path.join(root, ".open-next/assets/_headers"), "utf8"), headers, "the rule once");
  assert.equal(run.calls.filter((call) => call.args.includes("build")).length, 1, "--no-build uploads the build there is");
  fs.rmSync(root, { recursive: true });
});

test("--dry-run prints the comment and runs nothing but git; a site without the adapter or a Wrangler config is a usage error", async () => {
  const root = siteTree({ "content/pages/home.yaml": page("/") }, { bare: true });
  const run = stubShell({ changed: ["src/app/layout.tsx"] });
  const dry = await prPreview({ root, env: eventFile(root), flags: { dryRun: true }, fs, run, github: null });
  assert.equal(dry.status, "dry-run");
  assert.match(dry.body, /\*\*https:\/\/pr-12-<worker>\.<subdomain>\.workers\.dev\*\*[\s\S]*Every page: the change reaches the chrome/);
  assert.deepEqual([...new Set(run.calls.map((call) => call.command))], ["git"]);
  await assert.rejects(prPreview({ root, env: { ...eventFile(root), ...SECRETS }, flags: {}, fs, run, github: null }), (error) => error.usage && /the site has no @opennextjs\/cloudflare/.test(error.message));
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.mkdirSync(path.join(root, "node_modules/@opennextjs/cloudflare"), { recursive: true });
  assert.throws(() => checkCloudflare(root, fs), /the site has no Wrangler config \(wrangler\.jsonc, wrangler\.json, wrangler\.toml\)/);
  assert.equal(changedFiles("origin/main", () => ({ status: 128, stdout: "" })), null, "a shallow history lists nothing");
  fs.rmSync(root, { recursive: true });
});

test("upsertComment finds its comment past the first page of a long thread", async () => {
  const comments = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, body: i === 120 ? `${MARKER}\nold` : "x" }));
  const calls = [];
  const github = async (method, route, body) => {
    calls.push(`${method} ${route}`);
    if (method === "GET") { const pageNo = Number(new URLSearchParams(route.split("?")[1]).get("page")); return comments.slice((pageNo - 1) * 100, pageNo * 100); }
    return body;
  };
  assert.equal(await upsertComment({ github, repo: "owner/site", pr: 12, body: "new" }), "updated");
  assert.deepEqual(calls, ["GET /repos/owner/site/issues/12/comments?per_page=100&page=1", "GET /repos/owner/site/issues/12/comments?per_page=100&page=2", "PATCH /repos/owner/site/issues/comments/121"]);
});
