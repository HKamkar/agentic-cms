// The copy contract of every page section: what a page file
// (content/pages/<slug>.yaml) may say for each `type`, validated by the
// content engine as part of the `pages` collection. Only copy is here —
// eyebrows, headings, paragraphs, card titles and texts, stats, list items,
// button labels, image paths and alt texts. Everything the design decides
// (sizes, class strings, placeholder ratios) stays in the component, keyed
// by position; a card count that a component's layout is written for is fixed
// here, so a different count is a design change, not a content edit.
//
// This module is zod only (no React, no .tsx): src/lib/content/collections.ts
// imports it, so pnpm test and pnpm content:check load it under plain Node.
// The components are wired to these types in ./render.tsx.

import { z } from "zod";
import { forms } from "@/config/forms";
import { ref, text } from "agentic-cms/content";

const eyebrow = () => text().describe("The small label above the heading, as it should read (it is rendered uppercase)");
const heading = () => text().describe("The section heading");
const statement = () => text().describe("The statement paragraph the section leads with, set in heading type");
const paragraph = () => text().describe("The paragraph under the heading");
const cta = () => text().describe("The button label; the button links to the contact section (site.links.contact)");
const icon = () => text().describe("The card's icon, an image path under public/images/");
const image = (what: string) => ({
  image: text().describe(`${what}, under public/images/<page>/`),
  imageAlt: text().describe(`What the ${what.toLowerCase()} shows, in a sentence (it is informative, not decorative)`),
});
const stat = (what: string) => z.strictObject({
  title: text().describe(`${what}: the line above the number`),
  value: text().describe(`${what}: the big number or figure`),
  text: text().describe(`${what}: the line under the number`),
});
const cards = <S extends z.ZodRawShape>(shape: S, count: number, what = "cards") =>
  z.array(z.strictObject(shape), { error: `must be a list of ${what}` }).length(count, { error: `must have exactly ${count} ${what}` });
const section = <T extends string, S extends z.ZodRawShape>(type: T, shape: S, description: string) =>
  z.strictObject({ type: z.literal(type).describe("The section type"), ...shape }).describe(description);

const FORM_KEYS = Object.keys(forms);

// ---- home --------------------------------------------------------------------
const homeHero = section("home-hero", { eyebrow: eyebrow(), heading: heading(), text: paragraph(), cta: cta() }, "The home hero: eyebrow, H1, paragraph, the button and the hero illustration");
const homeAutomation = section(
  "home-automation",
  { eyebrow: eyebrow(), heading: heading(), cta: cta(), cards: cards({ icon: icon(), title: text().describe("The card title"), text: text().describe("The card text") }, 2) },
  "Two cards and the button beside an illustration",
);
const homeAbout = section(
  "home-about",
  { eyebrow: eyebrow(), statement: statement(), cards: cards({ title: text().describe("The card title"), stat: text().describe("The big figure"), text: text().describe("The line under the figure") }, 3) },
  "A statement and three stat cards",
);
const homeService = section(
  "home-service",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    text: paragraph(),
    feature: z.strictObject({ title: text().describe("The feature title under the icon"), text: text().describe("The feature text") }),
    cta: cta(),
    dashboard: z.strictObject({ title: text().describe("The dashboard card's title"), text: text().describe("The dashboard card's line"), ...image("The dashboard screenshot") }),
  },
  "A feature split: the dashboard card on the left, the copy, one feature and the button to the contact page on the right",
);
const homeFeature = section(
  "home-feature",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    text: paragraph(),
    cards: cards({ icon: icon(), title: text().describe("The card title"), text: text().describe("The card text") }, 5),
    monitoring: z.strictObject(image("The monitoring screenshot")),
  },
  "Five feature cards, the copy and a tall screenshot beside them",
);
const homeChooseUs = section(
  "home-choose-us",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    items: cards({ icon: icon(), title: text().describe("The item's title"), text: text().describe("The item's text") }, 3, "items"),
    demo: z.strictObject({ title: text().describe("The demo card's title"), ...image("The demo screenshot") }),
    stats: z.strictObject(image("The stats card")),
  },
  "Three points beside a demo card and a stats image",
);
const homeIntegration = section("home-integration", { eyebrow: eyebrow(), heading: heading() }, "The heading over an integration diagram (the diagram is the design's)");
const reviews = section("reviews", { eyebrow: eyebrow(), heading: heading() }, "The heading over the reviews; the reviews are content/reviews.yaml");

// ---- about -------------------------------------------------------------------
const aboutHero = section("about-hero", { eyebrow: eyebrow(), heading: heading(), text: paragraph() }, "The About hero: eyebrow, H1, paragraph and three illustration cards (the cards are the design's)");
const aboutStory = section(
  "about-story",
  {
    eyebrow: eyebrow(),
    statement: statement(),
    founded: text().describe("The caption of the first picture card"),
    sovereignty: stat("The first stat card").describe("The first stat card"),
    compliance: stat("The second stat card").describe("The second stat card"),
    partners: text().describe("The caption of the second picture card"),
    modalities: z
      .strictObject({
        heading: text().describe("The modality card's heading"),
        stat: text().describe("The modality card's big figure"),
        text: text().describe("The line under the figure"),
      })
      .describe("The modality card: heading, illustration, figure and line"),
  },
  "A statement and five cards: two picture cards with captions, two stat cards and the modality card",
);
const aboutStrategy = section(
  "about-strategy",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    text: paragraph(),
    beliefsHeading: text().describe("The heading over the list of beliefs"),
    beliefs: z.array(text(), { error: "must be a list of beliefs" }).length(4, { error: "must have exactly 4 beliefs" }).describe("The four beliefs"),
    cta: cta(),
  },
  "An illustration on one side; the copy, four beliefs and the button on the other",
);
const aboutBenefits = section(
  "about-benefits",
  { eyebrow: eyebrow(), heading: heading(), cards: cards({ icon: icon(), title: text().describe("The card title"), text: text().describe("The card text") }, 3) },
  "Three benefit cards",
);
const aboutChooseUs = section(
  "about-choose-us",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    text: paragraph(),
    cards: cards({ icon: icon(), title: text().describe("The card title"), text: text().describe("The card text") }, 2),
    cta: cta(),
  },
  "Copy, two cards and the button on one side; an illustration on the other",
);
const faq = section(
  "faq",
  {
    set: ref("faqs").describe("The FAQ set to show: the file name in content/faqs/"),
    eyebrow: eyebrow(),
    heading: heading(),
    variant: z.enum(["about", "contact"], { error: "must be about or contact" }).describe("The design variant, about or contact; the wireframe draws both the same and prints the name"),
  },
  "A FAQ section: eyebrow, heading and the accordion of a FAQ set; the page's FAQPage structured data reads the same set",
);

// ---- use cases ---------------------------------------------------------------
const useCasesHero = section("use-cases-hero", { eyebrow: eyebrow(), heading: heading(), text: paragraph(), cta: cta() }, "The Use cases hero: eyebrow, H1, paragraph and the button");
const useCasesVision = section(
  "use-cases-vision",
  { eyebrow: eyebrow(), statement: statement(), cards: cards({ stat: text().describe("The big figure"), text: text().describe("The line under the figure") }, 4) },
  "A statement and four stat cards",
);
const useCasesChooseUs = section(
  "use-cases-choose-us",
  { eyebrow: eyebrow(), heading: heading(), points: cards({ title: text().describe("The point's title"), text: text().describe("The point's text") }, 3, "points") },
  "Three points beside an illustration",
);
const useCaseCards = section("use-case-cards", { eyebrow: eyebrow(), heading: heading() }, "The heading over the use-case cards; the cards are content/use-cases.yaml");
const useCasesBenefits = section(
  "use-cases-benefits",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    left: cards({ icon: icon(), text: text().describe("The benefit, one line") }, 2, "benefits").describe("The two benefits left of the dashboard"),
    right: cards({ icon: icon(), text: text().describe("The benefit, one line") }, 2, "benefits").describe("The two benefits right of the dashboard"),
  },
  "Two benefits on each side of an illustration",
);
const useCasesStrategy = section(
  "use-cases-strategy",
  { eyebrow: eyebrow(), heading: heading(), cards: cards({ title: text().describe("The card title"), text: text().describe("The card text") }, 2), cta: cta() },
  "Two cards and the button beside an illustration",
);

// ---- contact -----------------------------------------------------------------
const contactHero = section("contact-hero", { eyebrow: eyebrow(), heading: heading(), text: paragraph(), cta: cta() }, "The Contact hero: eyebrow, H1, paragraph and the button");
const contactForm = section(
  "contact-form",
  { form: text().refine((key) => FORM_KEYS.includes(key), { error: `is not a form in src/config/forms.ts (${FORM_KEYS.join(", ")})` }).describe("The form to render, a key of src/config/forms.ts") },
  "The contact form; its fields and messages are the form definition",
);
const contactDetails = section(
  "contact-details",
  {
    eyebrow: eyebrow(),
    heading: heading(),
    cards: cards(
      {
        icon: icon(),
        title: text().describe("The card title"),
        text: z.array(text(), { error: "must be a list of lines" }).min(1, { error: "must have at least one line" }).describe("The card text, one paragraph per line (a line break between lines)"),
        highlight: z
          .discriminatedUnion(
            "kind",
            [
              z.strictObject({ kind: z.literal("text"), value: text().describe("The highlighted line, e.g. the office address") }),
              z.strictObject({ kind: z.literal("email"), value: text().describe("An e-mail address, rendered as a mailto link") }),
            ],
            { error: "must be text or email" },
          )
          .describe("The highlighted line under the rule: plain text, or an e-mail address as a link"),
      },
      3,
    ),
  },
  "Three contact cards, each with an icon, a title, its text and a highlighted line",
);

// ---- blog --------------------------------------------------------------------
const blogIndex = section(
  "blog-index",
  {
    label: text().describe("The hero's label"),
    heading: heading().describe("The hero's H1"),
    listEyebrow: text().describe("The eyebrow over the post grid"),
    listHeading: text().describe("The heading over the post grid"),
    cta: text().describe("The button label beside the heading (the button is the current page)"),
  },
  "The blog index: the hero and the grid of every published post, newest first",
);

// ---- the group wrapper -------------------------------------------------------
const group = section(
  "group",
  {
    variant: z.enum(["use-cases-upper", "use-cases-lower"], { error: "must be use-cases-upper or use-cases-lower" }).describe("Which of the design's two wrappers; the wireframe draws both as a dashed box that names the variant"),
    sections: z
      .array(
        z.lazy((): z.ZodType<Section> => sectionSchema),
        { error: "must be a list of sections" },
      )
      .min(1, { error: "must hold at least one section" })
      .describe("The sections inside the wrapper, in order"),
  },
  "A wrapper around several sections, for a design that decorates a run of them together",
);

const members = [
  homeHero, homeAutomation, homeAbout, homeService, homeFeature, homeChooseUs, homeIntegration, reviews,
  aboutHero, aboutStory, aboutStrategy, aboutBenefits, aboutChooseUs, faq,
  useCasesHero, useCasesVision, useCasesChooseUs, useCaseCards, useCasesBenefits, useCasesStrategy,
  contactHero, contactForm, contactDetails,
  blogIndex,
] as const;

export const SECTION_TYPES = [...members.map((member) => member.shape.type.value), "group"] as const;

/** Every section a page may list; `type` picks the schema. */
export const sectionSchema: z.ZodType<Section> = z.discriminatedUnion("type", [...members, group], {
  error: () => `must be one of ${SECTION_TYPES.join(", ")}`,
});

type Member = z.output<(typeof members)[number]>;
export type Group = { type: "group"; variant: "use-cases-upper" | "use-cases-lower"; sections: Section[] };
export type Section = Member | Group;
export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
/** What a section component receives: the section's fields without `type`. */
export type SectionProps<T extends SectionType> = Omit<SectionOf<T>, "type">;
