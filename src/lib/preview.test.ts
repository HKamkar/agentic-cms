// What a preview build (AGENTIC_CMS_PREVIEW=1) must not do, wherever the
// engine decides it: be indexed (every page's robots meta, robots.txt) or
// deliver a form to the site's destination (the endpoint's sink). Outside a
// preview, each answers as it always has.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createFormHandler } from "./forms/server/handler.ts";
import type { FormSink } from "./forms/server/sink.ts";
import type { FormDefinition } from "./forms/types.ts";
import { isPreview, PREVIEW_ENV } from "./preview.ts";
import { createRootMetadata } from "./seo/metadata.ts";
import { createRoutes } from "./seo/routes.ts";
import { createUrls, type SiteConfig } from "./site.ts";
import type { PageSeo } from "./seo/types.ts";

const SITE = { name: "Brand", shortName: "Brand", url: "https://brand.example", locale: "en", postPrefix: "/blog-post" } as SiteConfig;
const HOME = { title: "Brand: what it does", description: "What a reader finds on the home page, in one sentence." } as PageSeo;
const asPreview = () => { process.env[PREVIEW_ENV] = "1"; };
afterEach(() => { delete process.env[PREVIEW_ENV]; });

test("isPreview: AGENTIC_CMS_PREVIEW is \"1\", and nothing else", () => {
  assert.equal(isPreview({}), false);
  assert.equal(isPreview({ AGENTIC_CMS_PREVIEW: "true" }), false);
  assert.equal(isPreview({ AGENTIC_CMS_PREVIEW: "1" }), true);
  asPreview();
  assert.equal(isPreview(), true, "process.env by default");
});

test("a preview is never indexed: the root head adds noindex, nofollow, which every page inherits, and robots.txt disallows everything", () => {
  const rootMetadata = createRootMetadata(SITE, () => HOME);
  const robots = () => createRoutes({ site: SITE, urls: createUrls(SITE), content: {} as never, blog: {} as never }).robots();
  assert.equal(rootMetadata().robots, undefined);
  assert.deepEqual(robots().rules, { userAgent: "*", allow: "/" });
  asPreview();
  assert.deepEqual(rootMetadata().robots, { index: false, follow: false });
  assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" }, sitemap: "https://brand.example/sitemap.xml" });
});

test("a preview's form endpoint delivers to the server's log, never reading the site's destination", async () => {
  const form = { id: "contact", name: "Contact", items: [{ type: "email", name: "email", label: "E-mail", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" }, backend: { kind: "endpoint", url: "/api/forms/contact" } } satisfies FormDefinition;
  const delivered: unknown[] = [];
  let reads = 0;
  const sink = (): FormSink => { reads += 1; return { async deliver(submission) { delivered.push(submission); } }; };
  const handle = createFormHandler({ forms: { contact: form }, sink });
  const post = () => new Request("https://brand.example/api/forms/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" }, body: JSON.stringify({ values: { email: "ada@brand.dev" }, trap: "", elapsedMs: 5000, page: "https://brand.example/contact" }) });
  const logged: string[] = [];
  const info = console.info;
  console.info = (line: string) => { logged.push(line); };
  try {
    asPreview();
    assert.equal((await handle(post(), "contact")).status, 200);
    assert.deepEqual([reads, delivered.length], [0, 0], "the site's sink is not even read");
    assert.match(logged.join("\n"), /^\[forms\] contact /);
    delete process.env[PREVIEW_ENV];
    assert.equal((await handle(post(), "contact")).status, 200);
    assert.deepEqual([reads, delivered.length], [1, 1], "outside a preview, the site's destination");
  } finally { console.info = info; }
});
