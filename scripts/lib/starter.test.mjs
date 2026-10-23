// The starter init lays out in the example's content's place: its identity
// (the name, the slug, the address), its tokens, the voice file and the logo
// written for the name, and what the engine makes of its empty collections —
// the pages, the sitemap, the feed and the Blog's structured data with no post.
import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { withContent } from "../../src/lib/content/test-helpers.ts";
import { kit } from "../../src/kit.ts";
import { fill, logoSvg, NAME_EXAMPLE, siteIdentity, slugOf, StarterError, starterFiles, starterMarkdown, voiceFile } from "./starter.mjs";

const REPO = path.resolve(import.meta.dirname, "../..");
const NOW = new Date("2026-10-17T09:00:00Z");

/** The starter's content/ files, as withContent takes them (paths under content/). */
const starterContent = () => Object.fromEntries([...starterFiles(REPO, siteIdentity("my-site", { name: "My Site", now: NOW }))].filter(([file]) => file.startsWith("content/")).map(([file, text]) => [file.slice("content/".length), String(text)]));

describe("the site's identity", () => {
  test("the name is the owner's, never the folder's; the slug a DNS label from it; the address a stand-in on the slug's reserved domain", () => {
    assert.throws(() => siteIdentity("/x/my-site", { now: NOW }), (e) => e instanceof StarterError && e.message.includes(`--name "<Site>" (${NAME_EXAMPLE})`));
    assert.equal(NAME_EXAMPLE, 'agentic-cms init my-site --name "My Site"');
    assert.equal(slugOf("Café \"Ünï\" & Co."), "cafe-uni-co");
    assert.deepEqual(siteIdentity("/x/elsewhere", { name: " My Site ", now: NOW }), { name: "My Site", slug: "my-site", url: "https://my-site.example", email: "hello@my-site.example", domain: "my-site.example", today: "2026-10-17" });
    assert.equal(siteIdentity("/x/***", { name: "***" }).slug, "site", "a name with no letter to slug falls back");
    assert.equal(siteIdentity("/x/a", { name: "A", url: "http://localhost:8000/" }).url, "http://localhost:8000");
  });
  test("an empty name, a URL that is not an origin and an address that is not one are refused", () => {
    for (const [options, error] of [[{ name: " " }, /--name is empty/], [{ name: "A", url: "ftp://x.com" }, /give the site's origin alone/], [{ name: "A", url: "https://x.com/?a=1" }, /give the site's origin alone/], [{ name: "A", email: "a@b" }, /not an e-mail address/]]) {
      assert.throws(() => siteIdentity("/x/a", options), (e) => e instanceof StarterError && error.test(e.message));
    }
  });
});

describe("the starter's files", () => {
  test("a token is filled in escaped for the double-quoted string it sits in; an unknown one is a kit bug", () => {
    assert.equal(fill('name: "{{name}}"', { name: 'A "B" \\ C' }), 'name: "A \\"B\\" \\\\ C"');
    assert.throws(() => fill("{{nope}}", { name: "x" }, "templates/starter/x.yaml"), (e) => e instanceof StarterError && /templates\/starter\/x\.yaml: \{\{nope\}\} is no token of the starter \(name\)/.test(e.message));
  });
  test("every token of the starter is one the identity has, and every file lands where a site keeps it", () => {
    const files = starterFiles(REPO, siteIdentity("my-site", { name: "My Site", now: NOW }));
    for (const [file, text] of files) {
      assert.match(file, /^(?:content|public|src\/config)\//, file);
      if (typeof text === "string") assert.doesNotMatch(text, /\{\{\w+\}\}/, `${file}: a token left`);
    }
    assert.ok(files.has("public/images/brand/my-site-logo.svg") && files.has("content/VOICE.md"));
  });
  test("the voice file is the blank with the name in it; a blank that moved its note or its marker stops init", () => {
    const blank = "# Voice\n\n<!-- Copy this file to content/VOICE.md and write it. -->\n\nHow <the brand> writes.\n\n<!-- voice-rules:start -->\n```yaml\nbrand:\n  name: <the brand>\nclaims:\n  subject: \"\\\\b(?:<the brand>|we)\\\\b\"\n```\n<!-- voice-rules:end -->\n";
    const out = voiceFile(blank, "Ace.io");
    assert.match(out, /^How Ace\.io writes\.$/m);
    assert.match(out, /^ {2}name: "Ace\.io"$/m);
    assert.match(out, /subject: "\\\\b\(\?:Ace\\\\\.io\|we\)\\\\b"/, "escaped inside the expression");
    assert.match(out, /^<!-- agentic-cms init wrote this file/m);
    assert.throws(() => voiceFile("# Voice\n", "x"), StarterError);
  });
  test("a passage on the example's own pages goes, the starter's text in its place; a marked file without its markers stops init", () => {
    const text = "# S\n\n- one<!-- example:start -->\n- the example's<!-- example:end -->\n\n<!-- example:start -->\n| a | example |\n<!-- example:end -->\n<!-- starter: | a | starter |\n-->\n\nThe end; <!-- example:start -->its nine<!-- example:end --><!-- starter: its six -->.\n";
    assert.equal(starterMarkdown(text, "x.md"), "# S\n\n- one\n\n| a | starter |\n\nThe end; its six.\n");
    assert.throws(() => starterMarkdown("# STANDARD\n", "STANDARD.md"), (e) => e instanceof StarterError && /STANDARD\.md: no <!-- example:start --> marker/.test(e.message));
    assert.throws(() => starterMarkdown("<!-- example:start --> alone\n", "x.md"), /without its example:end/);
  });
  test("the logo placeholder names the site, escaped, its text sized to the box", () => {
    assert.match(logoSvg("A & B"), /aria-label="A &amp; B"[\s\S]*<title>A &amp; B<\/title>[\s\S]*font-size="36"[^>]*>A &amp; B<\/text>/);
    assert.match(logoSvg("A name long enough to need a smaller size"), /font-size="(\d+)"/);
    assert.ok(Number(logoSvg("A name long enough to need a smaller size").match(/font-size="(\d+)"/)[1]) < 36);
  });
});

describe("the starter's empty collections, as the engine reads them", () => {
  test("every collection reads with no entry, and the blog index's structured data is a Blog that lists no post", () => {
    withContent(starterContent(), () => {
      assert.deepEqual(kit.blog.getAllPosts(), []);
      assert.deepEqual(kit.blog.getAllCategories(), []);
      assert.deepEqual(kit.content.getReviews(), []);
      assert.deepEqual(kit.content.getUseCases(), []);
      assert.deepEqual(kit.content.getPages().map((entry) => entry.data.seo.path).sort(), ["/", "/blog"]);
      const ld = kit.seo.pageJsonLd(kit.content.getPage("blog"));
      assert.equal(ld["@type"], "Blog");
      assert.deepEqual(ld.blogPost, []);
    });
  });
  test("the sitemap names the two pages, and the feed is a channel with no item", async () => {
    const { paths, feed } = withContent(starterContent(), () => ({ paths: kit.seo.sitemap().map((entry) => new URL(entry.url).pathname).sort(), feed: kit.seo.feed() }));
    assert.deepEqual(paths, ["/", "/blog"]);
    const xml = await feed.text();
    assert.match(xml, /<channel>[\s\S]*<\/channel>/);
    assert.doesNotMatch(xml, /<item>/);
  });
});
