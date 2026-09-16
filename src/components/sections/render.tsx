// The section registry: which component renders each section type of a
// page file, and — for the sections that show a collection — how the page
// reads it for them (a client component such as the review slider cannot
// read files itself). The section's fields arrive as props without `type`;
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
import type { Section, SectionProps, SectionType } from "@/components/sections/schemas";
import { Benefits as UseCasesBenefits } from "@/components/use-cases/Benefits";
import { ChooseUs as UseCasesChooseUs } from "@/components/use-cases/ChooseUs";
import { Hero as UseCasesHero } from "@/components/use-cases/Hero";
import { Strategy as UseCasesStrategy } from "@/components/use-cases/Strategy";
import { UseCaseCards } from "@/components/use-cases/UseCaseCards";
import { Vision as UseCasesVision } from "@/components/use-cases/Vision";
import { getAllPosts } from "@/lib/blog/posts";
import { getFaq, getReviews, getUseCases } from "@/lib/content";

type Rendered = Exclude<SectionType, "group">;
type AnyProps = Record<string, unknown>;
/** A component that takes the section's fields, plus — through `resolve` — what the page reads for it (collection entries). */
type Registered<T extends Rendered> = { Component: ComponentType<AnyProps>; resolve?: (section: SectionProps<T>) => AnyProps };
type Registry = { [T in Rendered]: Registered<T> };

/** A section whose component takes only the section's fields. */
const plain = <T extends Rendered>(Component: ComponentType<SectionProps<T>>): Registered<T> => ({ Component: Component as ComponentType<AnyProps> });

/** A section whose component also takes what `resolve` reads for it; the types must agree. */
const withData = <T extends Rendered, X extends AnyProps>(Component: ComponentType<SectionProps<T> & X>, resolve: (section: SectionProps<T>) => X): Registered<T> => ({
  Component: Component as ComponentType<AnyProps>,
  resolve,
});

const registry: Registry = {
  "home-hero": plain(HomeHero),
  "home-automation": plain(HomeAutomation),
  "home-about": plain(HomeAbout),
  "home-service": plain(HomeService),
  "home-feature": plain(HomeFeature),
  "home-choose-us": plain(HomeChooseUs),
  "home-integration": plain(HomeIntegration),
  reviews: withData(Testimonials, () => ({ reviews: getReviews() })),
  "about-hero": plain(AboutHero),
  "about-story": plain(AboutStory),
  "about-strategy": plain(AboutStrategy),
  "about-benefits": plain(AboutBenefits),
  "about-choose-us": plain(AboutChooseUs),
  faq: withData(FaqSection, (section) => ({ items: getFaq(section.set).items })),
  "use-cases-hero": plain(UseCasesHero),
  "use-cases-vision": plain(UseCasesVision),
  "use-cases-choose-us": plain(UseCasesChooseUs),
  "use-case-cards": withData(UseCaseCards, () => ({ cards: getUseCases() })),
  "use-cases-benefits": plain(UseCasesBenefits),
  "use-cases-strategy": plain(UseCasesStrategy),
  "contact-hero": plain(ContactHero),
  "contact-form": plain(ContactForm),
  "contact-details": plain(ContactDetails),
  "blog-index": withData(BlogIndex, () => ({ posts: getAllPosts() })),
};

/** The sections of a page, in order, each rendered by its registered component. */
export function renderSections(sections: Section[]) {
  return sections.map((section, i) => {
    if (section.type === "group") {
      return (
        <Group key={i} variant={section.variant}>
          {renderSections(section.sections)}
        </Group>
      );
    }
    const { type, ...props } = section;
    const entry = registry[type] as Registered<typeof type>;
    return <entry.Component key={i} {...props} {...entry.resolve?.(props as SectionProps<typeof type>)} />;
  });
}
