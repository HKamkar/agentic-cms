// The preview of a pull request behind `agentic-cms pr-preview`
// (docs/preview.md, docs/roadmap-0.9.0.md job 11): the site built as
// production with AGENTIC_CMS_PREVIEW=1, uploaded as a Cloudflare Workers
// version that is not deployed, under the alias pr-<n> (D16: the same link
// on every push, showing the latest), and one comment on the pull request,
// updated on each push: the link and the pages the change touches. A
// preview is not the site: every page carries noindex (the engine's head
// and robots.txt, and a _headers file over the static files), the form
// endpoint delivers to a log (the version's AGENTIC_CMS_PREVIEW var), no
// analytics tag loads. A pull request from a fork has no secrets, and the
// run says it made no preview. The shell comes in as `run(command, args,
// { env })` → { status, stdout, stderr }, GitHub's API as `github(method,
// path, body)`, the file system as `fs`, so the tests need neither
// wrangler, a network nor a pull request.
import path from "node:path";
import { parse as parseYaml } from "yaml";

/** The marker the one comment carries, so each push finds and updates it. */
export const MARKER = "<!-- agentic-cms:pr-preview -->";
/** The flag a preview build and a preview version carry (src/lib/preview.ts). */
export const PREVIEW_ENV = "AGENTIC_CMS_PREVIEW";
/** The secrets a preview needs, the site owner's. */
export const SECRETS = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
/** The rule the preview build adds to the static files, which the Worker's assets serve without its code: none indexed. */
export const NOINDEX_HEADERS = "/*\n  X-Robots-Tag: noindex, nofollow\n";
const ASSETS = ".open-next/assets";
const WRANGLER_CONFIGS = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"];
const PAGES = "content/pages";
const POSTS = "content/blog";
/** Files no page is built from: the docs (Markdown outside content/), the agent files, CI, the content's notes, templates and schemas, the redirects, the tests. */
const NO_PAGE = [/^docs\//, /^\.github\//, /^\.claude\//, /^\.agents\//, /^\.agentic-cms(?:\/|\.json$)/, /^plugin\//, /^content\/(?:editorial|_templates|_schemas)\//, /^content\/(?:README|VOICE)\.md$/, /^content\/redirects\.ya?ml$/, /^(?!content\/).*\.md$/, /\.test\.[cm]?[jt]sx?$/, /^\.(?:gitignore|nvmrc|env\.example)$/, /^scripts\/setup\.sh$/];

/** A step of the preview that failed (exit 1), or a run that cannot make one here (exit 2, `usage`). */
export class PreviewError extends Error {
  constructor(message, { usage = false } = {}) { super(message); this.usage = usage; }
}

const readJson = (fs, file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };

/**
 * The pull request this run previews: { pr, base, sha, fork, repo } — the
 * number from --pr or GitHub's event, the base the change is diffed
 * against (--base, else the pull request's base branch on origin), the
 * head commit, and whether its head is a fork. Throws a usage PreviewError
 * without a number.
 */
export function pullRequestOf({ env, fs, flags, run }) {
  const event = env.GITHUB_EVENT_PATH ? readJson(fs, env.GITHUB_EVENT_PATH) : null;
  const request = event?.pull_request;
  const pr = flags.pr || request?.number;
  if (!pr) throw new PreviewError("no pull request: run it in a pull_request workflow, or name one with --pr <n>", { usage: true });
  const repo = env.GITHUB_REPOSITORY ?? "";
  const fork = Boolean(request?.head?.repo?.full_name && repo && request.head.repo.full_name !== repo);
  const base = flags.base || (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : "origin/HEAD");
  const sha = request?.head?.sha ?? run("git", ["rev-parse", "HEAD"]).stdout.trim();
  return { pr: Number(pr), base, sha, fork, repo };
}

/** Why this run makes no preview, or null: a fork's run has no secrets, and a run without them makes none. */
export function noPreviewReason({ fork }, env) {
  if (fork) return "a pull request from a fork has no secrets, so this run made no preview; the site's own branches get one (docs/preview.md)";
  const missing = SECRETS.filter((name) => !env[name]);
  if (missing.length) return `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set, so this run made no preview: the site owner adds ${missing.length > 1 ? "them" : "it"} as the repository's secrets (docs/preview.md)`;
  return null;
}

/** What a preview needs in the site: OpenNext's Cloudflare adapter and a Wrangler config; a usage PreviewError naming the fix. */
export function checkCloudflare(root, fs) {
  if (!fs.existsSync(path.join(root, "node_modules/@opennextjs/cloudflare"))) throw new PreviewError("the site has no @opennextjs/cloudflare: a preview is a Workers version of the site, built by OpenNext (docs/deploy.md § Cloudflare)", { usage: true });
  if (!WRANGLER_CONFIGS.some((file) => fs.existsSync(path.join(root, file)))) throw new PreviewError(`the site has no Wrangler config (${WRANGLER_CONFIGS.join(", ")}): the Worker a preview is a version of (docs/deploy.md § Cloudflare)`, { usage: true });
}

/** The posts' URL prefix as site.ts writes it (the starter's when it names none). */
export const postPrefixOf = (text) => text.match(/^\s*postPrefix:\s*["'`]([^"'`\n]+)["'`]/m)?.[1] ?? "/blog-post";
const parsed = (text) => { try { return parseYaml(text); } catch { return null; } };
const draftPost = (text) => parsed(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "")?.draft === true;
/** A page's picture folder and Open Graph image are named by its route, slashes as hyphens: / → home, /sections/about → sections-about. */
const pictureName = (route) => (route === "/" ? "home" : route.slice(1).replaceAll("/", "-"));

/** Whether a page's data holds an FAQ section that reads the set `key`, at any depth (a group's sections nest). */
function readsFaq(value, key) {
  if (Array.isArray(value)) return value.some((item) => readsFaq(item, key));
  if (!value || typeof value !== "object") return false;
  if (value.type === "faq" && value.set === key) return true;
  return Object.values(value).some((item) => readsFaq(item, key));
}

/**
 * The pages a change touches, from the files it changes: { every, pages } —
 * `every` the files that reach every page (the chrome, a component, the
 * config, a collection more than one page reads, a shared picture), else
 * null; `pages` each page or post it touches, { route, file, state:
 * "changed" | "draft" | "removed" }. A file no page is built from (NO_PAGE)
 * touches none; an FAQ set the pages that name it; a picture folder or an
 * Open Graph image the page or post it is named for. `show(file)` reads a
 * file at the base, for a page the change removed.
 */
export function touchedPages(root, files, { fs, show = () => null }) {
  const read = (file) => { try { return fs.readFileSync(path.join(root, file), "utf8"); } catch { return null; } };
  const prefix = postPrefixOf(read("src/config/site.ts") ?? "");
  const pageFiles = (fs.existsSync(path.join(root, PAGES)) ? fs.readdirSync(path.join(root, PAGES)) : []).filter((name) => /^[^_].*\.ya?ml$/.test(name)).map((name) => `${PAGES}/${name}`);
  const pages = new Map(pageFiles.map((file) => [file, parsed(read(file) ?? "")]).filter(([, data]) => typeof data?.seo?.path === "string"));
  const byPicture = new Map([...pages].map(([file, data]) => [pictureName(data.seo.path), { route: data.seo.path, file }]));
  const touched = new Map();
  const every = [];
  const add = (route, file, state = "changed") => { if (!touched.has(route)) touched.set(route, { route, file, state }); };
  for (const file of files) {
    if (NO_PAGE.some((re) => re.test(file))) continue;
    const page = file.match(new RegExp(`^${PAGES}/([^/_][^/]*)\\.ya?ml$`));
    const post = file.match(new RegExp(`^${POSTS}/([^/_][^/]*)\\.mdx?$`));
    const faq = file.match(/^content\/faqs\/([^/_][^/]*)\.ya?ml$/);
    const picture = file.match(/^public\/images\/(?:blog\/([^/]+)\/|([^/]+)\/|([^/]+)-og\.jpg$)/);
    if (page) {
      const route = pages.get(file)?.seo.path ?? parsed(show(file) ?? "")?.seo?.path;
      if (route) add(route, file, pages.has(file) ? "changed" : "removed");
    } else if (post) {
      const text = read(file);
      add(`${prefix}/${post[1]}`, file, text === null ? "removed" : draftPost(text) ? "draft" : "changed");
    } else if (faq) {
      for (const [pageFile, data] of pages) if (readsFaq(data, faq[1])) add(data.seo.path, pageFile);
    } else if (picture?.[1] && fs.existsSync(path.join(root, POSTS, `${picture[1]}.md`))) {
      add(`${prefix}/${picture[1]}`, `${POSTS}/${picture[1]}.md`);
    } else if (byPicture.has(picture?.[2] ?? picture?.[3])) {
      const { route, file: pageFile } = byPicture.get(picture[2] ?? picture[3]);
      add(route, pageFile);
    } else every.push(file);
  }
  return { every: every.length ? every : null, pages: [...touched.values()].sort((a, b) => a.route.localeCompare(b.route, "en")) };
}

/** The files the change touches against its base, git's three-dot diff; null when the history cannot say (a shallow clone). */
export function changedFiles(base, run) {
  const result = run("git", ["diff", "--name-only", `${base}...HEAD`]);
  return result.status === 0 ? result.stdout.split("\n").filter(Boolean) : null;
}

const STATES = { changed: "", draft: " — a draft, which the preview leaves out as production does", removed: " — removed" };
const MAX_LISTED = 5;

/** The comment's scope line: every page, none, or nothing to say before the list; the shallow case when the files could not be listed. */
function scopeLines(touched) {
  if (!touched) return ["Every page could be touched: the change's files could not be listed against its base (a shallow checkout; the workflow's checkout takes `fetch-depth: 0`)."];
  if (touched.every) {
    const named = touched.every.slice(0, MAX_LISTED).map((file) => `\`${file}\``).join(", ");
    return [`Every page: the change reaches the chrome, a component, the config or a collection more than one page reads (${named}${touched.every.length > MAX_LISTED ? `, and ${touched.every.length - MAX_LISTED} more` : ""}).`];
  }
  return touched.pages.length ? [] : ["No page: the change touches nothing a page is built from."];
}

/** The comment's text: the marker, the link and the push it shows, what the preview is not, and the pages the change touches, each a link while the preview has it. */
export function previewComment({ url, sha, touched }) {
  const origin = url.replace(/\/$/, "");
  const intro = [MARKER, "### Preview", "", `**${url}** shows this pull request at \`${sha.slice(0, 7)}\`: every page as a production build makes it, never indexed, its forms delivered to a log, no analytics tag. The link stays the same on every push.`, ""];
  const scope = scopeLines(touched);
  const items = (touched?.pages ?? []).map(({ route, file, state }) => `- ${state === "changed" ? `[\`${route}\`](${origin}${route})` : `\`${route}\``}${STATES[state]} (\`${file}\`)`);
  const list = items.length ? [touched.every ? "The pages it changes itself:" : "The pages the change touches:", "", ...items] : [];
  return `${[...intro, ...scope, ...(scope.length && list.length ? [""] : []), ...list].join("\n")}\n`;
}

/** The static files' noindex rule in the built Worker's assets: OpenNext's _headers kept, the rule added once. */
export function writeNoindexHeaders(root, fs) {
  const file = path.join(root, ASSETS, "_headers");
  if (!fs.existsSync(path.dirname(file))) throw new PreviewError(`no ${ASSETS}: the OpenNext build did not run`);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!current.includes("X-Robots-Tag: noindex")) fs.writeFileSync(file, `${NOINDEX_HEADERS}${current ? `\n${current}` : ""}`);
}

/**
 * The built Worker uploaded as a version, not deployed, under `alias`, with
 * the preview flag as a var (the form endpoint reads it at request time):
 * OpenNext's upload passes the flags to `wrangler versions upload`. The URL
 * comes from wrangler's output file (WRANGLER_OUTPUT_FILE_PATH), never from
 * its log. { url, version }.
 */
export function uploadVersion({ alias, outputFile, run, fs }) {
  fs.rmSync(outputFile, { force: true });
  const result = run("pnpm", ["exec", "opennextjs-cloudflare", "upload", "--preview-alias", alias, "--var", `${PREVIEW_ENV}:1`], { env: { WRANGLER_OUTPUT_FILE_PATH: outputFile } });
  if (result.status !== 0) throw new PreviewError(`opennextjs-cloudflare upload answered ${result.status}: ${String(result.stderr ?? "").trim().split("\n").slice(-3).join(" ")}`);
  const entries = (fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8") : "").split("\n").filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } });
  const upload = entries.filter((entry) => entry?.type === "version-upload").at(-1);
  const url = upload?.preview_alias_url ?? upload?.preview_url;
  if (!url) throw new PreviewError("the version went up, but wrangler named no preview URL: turn on the Worker's preview URLs (its Settings › Domains & Routes, or preview_urls: true in its Wrangler config)");
  return { url, version: upload.version_id };
}

/** The one comment, by its marker: updated when the pull request has it, else created; GitHub's API through `github(method, path, body)`. */
export async function upsertComment({ github, repo, pr, body }) {
  for (let page = 1; page <= 10; page += 1) {
    const comments = await github("GET", `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`);
    const own = comments.find((comment) => comment.body?.includes(MARKER));
    if (own) { await github("PATCH", `/repos/${repo}/issues/comments/${own.id}`, { body }); return "updated"; }
    if (comments.length < 100) break;
  }
  await github("POST", `/repos/${repo}/issues/${pr}/comments`, { body });
  return "created";
}

/** GitHub's REST API with the workflow's token, as upsertComment() calls it; a failure is a PreviewError with the status. */
export function githubApi({ token, fetch, api = "https://api.github.com" }) {
  return async (method, route, body) => {
    const response = await fetch(`${api}${route}`, { method, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new PreviewError(`GitHub answered ${response.status} to ${method} ${route}${response.status === 403 ? ": the job needs permissions: pull-requests: write" : ""}`);
    return response.status === 204 ? null : response.json();
  };
}

/**
 * The run: the pull request, then — unless a fork or missing secrets mean
 * no preview, which it says — the build as production with the preview
 * flag (the placeholders warnings, as in CI), the noindex headers, the
 * upload under pr-<n>, the pages touched and the comment. `flags`: pr,
 * base, build (false: upload the build there is), comment (false: print
 * it only), dryRun (the pages and the comment, nothing built, uploaded or
 * posted). { status: "skipped", reason } | { status: "previewed" | "dry-run",
 * pr, alias, url, touched, body, comment }.
 */
export async function prPreview({ root, env, flags, fs, run, github, log = () => {} }) {
  const request = pullRequestOf({ env, fs, flags, run });
  const alias = `pr-${request.pr}`;
  const reason = flags.dryRun ? null : noPreviewReason(request, env);
  if (reason) return { status: "skipped", pr: request.pr, reason };
  const show = (file) => { const r = run("git", ["show", `${request.base}:./${file}`]); return r.status === 0 ? r.stdout : null; };
  const files = changedFiles(request.base, run);
  const touched = files && touchedPages(root, files, { fs, show });
  if (flags.dryRun) {
    const body = previewComment({ url: `https://${alias}-<worker>.<subdomain>.workers.dev`, sha: request.sha || "0000000", touched });
    return { status: "dry-run", pr: request.pr, alias, url: null, touched, body, comment: null };
  }
  checkCloudflare(root, fs);
  if (flags.build !== false) {
    log("pr-preview: building the site as production, with AGENTIC_CMS_PREVIEW=1");
    const built = run("pnpm", ["exec", "opennextjs-cloudflare", "build"], { env: { [PREVIEW_ENV]: "1", AGENTIC_CMS_PLACEHOLDERS: "warn" } });
    if (built.status !== 0) throw new PreviewError(`the preview build failed (opennextjs-cloudflare build answered ${built.status}): its log says why`);
  }
  writeNoindexHeaders(root, fs);
  log(`pr-preview: uploading a version under the alias ${alias}, not deployed`);
  const { url } = uploadVersion({ alias, outputFile: path.join(env.RUNNER_TEMP || root, `wrangler-${alias}.json`), run, fs });
  const body = previewComment({ url, sha: request.sha, touched });
  const comment = flags.comment === false || !github ? null : await upsertComment({ github, repo: request.repo, pr: request.pr, body });
  return { status: "previewed", pr: request.pr, alias, url, touched, body, comment };
}
