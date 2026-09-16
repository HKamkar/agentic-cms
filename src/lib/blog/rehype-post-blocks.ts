// Reshapes a rendered post body into the blocks of the post template, so the
// page gets the same layout and the same staggered reveals as the design:
//
//   run     a run of ordinary content (the element rules of a post body)
//   quote   a pull-quote card (from a markdown blockquote)
//   image   a standalone image paragraph, full width in a frame
//   faq     `## Frequently asked questions` and what follows: the accordion
//
// The class names come in as options (PostBody.tsx owns them). Every block
// is emitted as an <fx> element (mapped to the Fx component) with the delays
// of the template: 200, 300, 400, 500, then 600.

import type { Element, ElementContent, Root, RootContent } from "hast";
import { toString } from "hast-util-to-string";

export type PostBlockClasses = {
  run: string;
  quote: string;
  quoteInner: string;
  quoteIcon: string;
  quoteText: string;
  image: string;
  imageWrap: string;
  imageImg: string;
  faqHeading: string;
  faq: string;
};

const el = (tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});
const classes = (s: string) => s.split(" ").filter(Boolean);

const isBlank = (n: RootContent) => n.type === "text" && !n.value.trim();
const isImageOnly = (n: Element) =>
  n.tagName === "p" && n.children.filter((c) => !(c.type === "text" && !c.value.trim())).every((c) => c.type === "element" && c.tagName === "img") && n.children.some((c) => c.type === "element");

function quoteBlock(quote: Element, c: PostBlockClasses): Element {
  const inline: ElementContent[] = [];
  for (const child of quote.children) {
    if (child.type === "element" && child.tagName === "p") {
      if (inline.length) inline.push({ type: "element", tagName: "br", properties: {}, children: [] });
      inline.push(...child.children);
    } else if (!(child.type === "text" && !child.value.trim())) {
      inline.push(child);
    }
  }
  return el("div", { className: classes(c.quote) }, [
    el("div", { className: classes(c.quoteInner) }, [
      el("img", { width: 44, height: 30, alt: "", src: c.quoteIcon, loading: "lazy" }),
      el("p", { className: classes(c.quoteText) }, inline),
    ]),
  ]);
}

function imageBlock(paragraph: Element, c: PostBlockClasses): Element {
  const img = paragraph.children.find((n): n is Element => n.type === "element" && n.tagName === "img")!;
  return el("div", { className: classes(c.image) }, [
    el("div", { className: classes(c.imageWrap) }, [el("img", { ...img.properties, loading: "lazy", className: classes(c.imageImg) })]),
  ]);
}

export default function rehypePostBlocks({ classes: c }: { classes: PostBlockClasses }) {
  return (tree: Root) => {
    const blocks: Element[] = [];
    let run: ElementContent[] = [];
    const flush = () => {
      if (run.length) blocks.push(el("div", { className: classes(c.run) }, run));
      run = [];
    };

    const nodes = tree.children;
    const esm: RootContent[] = []; // MDX import/export statements must stay at the root
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (isBlank(n)) continue;
      if (n.type !== "element") {
        if ((n as { type: string }).type === "mdxjsEsm") esm.push(n);
        else if (n.type !== "doctype") run.push(n as ElementContent);
        continue;
      }
      if (n.tagName === "blockquote") {
        flush();
        blocks.push(quoteBlock(n, c));
        continue;
      }
      if (isImageOnly(n)) {
        flush();
        blocks.push(imageBlock(n, c));
        continue;
      }
      if (n.tagName === "h2" && /frequently asked|faq/i.test(toString(n))) {
        flush();
        const faq: ElementContent[] = [];
        let j = i + 1;
        while (j < nodes.length && !(nodes[j].type === "element" && (nodes[j] as Element).tagName === "h2")) {
          const m = nodes[j];
          if (!isBlank(m) && m.type !== "doctype") faq.push(m as ElementContent);
          j++;
        }
        blocks.push(el("h2", { ...n.properties, className: classes(c.faqHeading) }, n.children));
        blocks.push(el("div", { className: classes(c.faq), dataFaq: "" }, faq));
        i = j - 1;
        continue;
      }
      run.push(n);
    }
    flush();

    tree.children = [
      ...esm,
      ...blocks.map((block, i) => {
        const delay = Math.min(200 + i * 100, 600);
        return el("fx", { as: block.tagName, delay, ...block.properties }, block.children);
      }),
    ];
  };
}
