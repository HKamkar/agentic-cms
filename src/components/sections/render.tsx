// The section registry: which component renders each section type of a
// page file, and — for the sections that show a collection or link to a
// page of the site — how the page reads it for them, in the page's language
// (a client component such as the review slider cannot read files itself).
// The section's fields arrive as props without `type`;
// the schemas that validate them are ./schemas.ts, kept apart from this file
// because this one imports components and the schemas must load under plain
// Node. A group wrapper renders its children through the same function.

import type { ComponentType } from "react";
import { Benefits as AboutBenefits } from "@/components/about/Benefits";
import { ChooseUs as AboutChooseUs } from "@/components/about/ChooseUs";
import { Hero as AboutHero } from "@/components/about/Hero";
import { ContactForm } from "@/components/contact/ContactForm";
import { Details as ContactDetails } from "@/components/contact/Details";
import { Hero as ContactHero } from "@/components/contact/Hero";
import { Story as AboutStory } from "@/components/about/Story";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { Strategy as AboutStrategy } from "@/components/about/Strategy";
import { About as HomeAbout } from "@/components/home/About";
import { Automation as HomeAutomation } from "@/components/home/Automation";
import { ChooseUs as HomeChooseUs } from "@/components/home/ChooseUs";
import { Feature as HomeFeature } from "@/components/home/Feature";
import { Hero as HomeHero } from "@/components/home/Hero";
import { Integration as HomeIntegration } from "@/components/home/Integration";
import { Service as HomeService } from "@/components/home/Service";
import { Testimonials } from "@/components/home/Testimonials";
import { FaqSection } from "@/components/sections/FaqSection";
import { Group } from "@/components/sections/Group";
import type { CtaHref, Section, SectionProps, SectionType } from "@/components/sections/schemas";
import { Benefits as UseCasesBenefits } from "@/components/use-cases/Benefits";
import { ChooseUs as UseCasesChooseUs } from "@/components/use-cases/ChooseUs";
import { Hero as UseCasesHero } from "@/components/use-cases/Hero";
import { Strategy as UseCasesStrategy } from "@/components/use-cases/Strategy";
import { UseCaseCards } from "@/components/use-cases/UseCaseCards";
import { Vision as UseCasesVision } from "@/components/use-cases/Vision";
import { kit } from "@/kit";

type Rendered = Exclude<SectionType, "group">;
type AnyProps = Record<string, unknown>;
/** What a section reads in the page's language: its config (the links), its content, its posts. */
type Scope = { site: ReturnType<typeof kit.locales.site>; content: ReturnType<typeof kit.content.in>; blog: ReturnType<typeof kit.blog.in> };
/** A component that takes the section's fields, plus — through `resolve` — what the page reads for it in its language (collection entries, a link). */
type Registered<T extends Rendered> = { Component: ComponentType<AnyProps>; resolve?: (section: SectionProps<T>, scope: Scope) => AnyProps };
type Registry = { [T in Rendered]: Registered<T> };

/** A section whose component takes only the section's fields. */
const plain = <T extends Rendered>(Component: ComponentType<SectionProps<T>>): Registered<T> => ({ Component: Component as ComponentType<AnyProps> });

/** A section whose component also takes what `resolve` reads for it; the types must agree. */
const withData = <T extends Rendered, X extends AnyProps>(Component: ComponentType<SectionProps<T> & X>, resolve: (section: SectionProps<T>, scope: Scope) => X): Registered<T> => ({
  Component: Component as ComponentType<AnyProps>,
  resolve,
});

/** A section whose call to action goes to the contact link of the page's language. */
const toContact = <T extends Rendered>(Component: ComponentType<SectionProps<T> & CtaHref>) => withData<T, CtaHref>(Component, (_, { site }) => ({ ctaHref: site.links.contact }));

const registry: Registry = {
  "home-hero": toContact(HomeHero),
  "home-automation": toContact(HomeAutomation),
  "home-about": plain(HomeAbout),
  "home-service": toContact(HomeService),
  "home-feature": plain(HomeFeature),
  "home-choose-us": plain(HomeChooseUs),
  "home-integration": plain(HomeIntegration),
  reviews: withData(Testimonials, (_, { content }) => ({ reviews: content.getReviews() })),
  "about-hero": plain(AboutHero),
  "about-story": plain(AboutStory),
  "about-strategy": toContact(AboutStrategy),
  "about-benefits": plain(AboutBenefits),
  "about-choose-us": toContact(AboutChooseUs),
  faq: withData(FaqSection, (section, { content }) => ({ items: content.getFaq(section.set).items })),
  "use-cases-hero": toContact(UseCasesHero),
  "use-cases-vision": plain(UseCasesVision),
  "use-cases-choose-us": plain(UseCasesChooseUs),
  "use-case-cards": withData(UseCaseCards, (_, { content }) => ({ cards: content.getUseCases() })),
  "use-cases-benefits": plain(UseCasesBenefits),
  "use-cases-strategy": toContact(UseCasesStrategy),
  "contact-hero": toContact(ContactHero),
  "contact-form": plain(ContactForm),
  "contact-details": plain(ContactDetails),
  "blog-index": withData(BlogIndex, (_, { site, blog }) => ({ posts: blog.getAllPosts(), ctaHref: site.links.blog })),
};

/** What a section reads in the language: its config, its content, its posts. */
const scopeIn = (locale: string): Scope => ({ site: kit.locales.site(locale), content: kit.content.in(locale), blog: kit.blog.in(locale) });

/** The sections of a page, in order, each rendered by its registered component, in the page's language (`locale`, the default one's when left out). */
export function renderSections(sections: Section[], locale: string = kit.locales.default.locale) {
  return renderIn(sections, scopeIn(locale));
}

/** What the registry reads for a section beyond its copy, in the page's language (a collection's entries, a link): what a design round's route passes its candidates. */
export function sectionData<T extends Rendered>(type: T, props: SectionProps<T>, locale: string = kit.locales.default.locale): AnyProps {
  return (registry[type] as Registered<T>).resolve?.(props, scopeIn(locale)) ?? {};
}

function renderIn(sections: Section[], scope: Scope): React.ReactNode[] {
  return sections.map((section, i) => {
    if (section.type === "group") {
      return (
        <Group key={i} variant={section.variant}>
          {renderIn(section.sections, scope)}
        </Group>
      );
    }
    const { type, ...props } = section;
    const entry = registry[type] as Registered<typeof type>;
    return <entry.Component key={i} {...props} {...entry.resolve?.(props as SectionProps<typeof type>, scope)} />;
  });
}
