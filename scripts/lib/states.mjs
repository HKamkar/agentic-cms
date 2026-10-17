// The interaction states a `visual-parity capture --states` photographs: what
// the other modes never reach — a link hovered, a field focused, a checkbox
// checked, a FAQ open. Each row names its page, the element it acts on
// (`target`, located by role and text from the site's config and content,
// never by class, so the same list works before and after a markup rewrite)
// and what it does to it (`act`, which returns the element whose box is
// photographed). A row is chosen only where the build has what it looks for:
// the first page file with a form or a FAQ section, the first post whose body
// has the FAQ its page renders as an accordion; a build without one drops the
// row. A target the page still lacks when the capture gets there is the
// capture's to skip and record, never a timeout that ends the run
// (visual-parity.mjs). docs/visual-parity.md has the contract.

const POST = "/blog-post/";

/** The route of the first page file (folder order) with a section of that type, looking inside group wrappers; undefined when none has one. */
export function pageWith(kit, type) {
  const holds = (sections) => sections.some((section) => section.type === type || (section.type === "group" && holds(section.sections)));
  return kit.content.getPages().find((entry) => holds(entry.data.sections))?.data.seo.path;
}

/**
 * The first post route of the build (route order) whose body has a FAQ, by the kit's own test — the FAQPage its
 * page emits beside the accordion; undefined when no post has one. The accordion's toggle carries aria-expanded
 * only once the page has hydrated, so the build's HTML cannot say; the content can.
 */
export function faqPost(kit, routes) {
  return routes.find((route) => {
    if (!route.startsWith(POST)) return false;
    const post = kit.blog.getPostBySlug(route.slice(POST.length));
    return Boolean(post && kit.seo.postFaqJsonLd(post));
  });
}

// The first disclosure toggle on the page (FAQ), whatever element carries it.
const faqToggle = (p) => p.getByRole("main").locator("[aria-expanded]").first();
const hover = async (_page, el) => { await el.hover(); return el; };

/**
 * The states of a build, each { page, width, name, target(page), act(page, el) }: the three labels a hover looks
 * for come from the site's config (the CTA, a nav entry that is a page of its own rather than an anchor, the
 * second footer quick link); `post`, `form` and `faq` are the pages that show a post FAQ, a form and a FAQ, and a
 * row whose page is undefined is dropped.
 */
export const statesOf = ({ site, post, form, faq }) => [
  { page: "/", width: 1440, name: "cta-hover", target: (p) => p.getByRole("link", { name: site.cta.label }).first(), act: hover },
  { page: "/", width: 1440, name: "nav-link-hover", target: (p) => p.getByRole("navigation").getByRole("link", { name: (site.nav.find((item) => item.href !== "/" && !item.href.includes("#")) ?? site.nav[1]).label }).first(), act: hover },
  { page: "/", width: 1440, name: "footer-link-hover", target: (p) => p.getByRole("contentinfo").getByRole("link", { name: site.footer.quickLinks[1].label }), act: hover },
  { page: site.links.blog, width: 1440, name: "card-hover", target: (p) => p.getByRole("main").locator("a:has(img[alt]:not([alt='']))").first(), act: hover },
  { page: form, width: 1440, name: "field-focus", target: (p) => p.getByRole("textbox").first(), act: async (_p, el) => { await el.focus(); return el; } },
  { page: form, width: 1440, name: "checkbox-checked", target: (p) => p.locator("label:has(input[type=checkbox])").first(), act: async (_p, el) => { await el.click(); return el; } },
  { page: faq, width: 1440, name: "faq-open", target: faqToggle, act: async (_p, el) => { await el.click(); return el.locator("xpath=ancestor::section[1]"); } },
  { page: post, width: 1440, name: "post-faq-open", target: faqToggle, act: async (_p, el) => { await el.scrollIntoViewIfNeeded(); await el.click(); return el.locator("xpath=ancestor::div[1]"); } },
].filter((state) => state.page);

/** The states of a build from the site's kit and the build's routes. */
export const statesFor = (kit, routes) => statesOf({ site: kit.site, post: faqPost(kit, routes), form: pageWith(kit, "contact-form"), faq: pageWith(kit, "faq") });
