import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import type { SectionProps } from "@/components/sections/schemas";

/** The Use cases hero: the page's H1, its paragraph and the one button under them. */
export function Hero({ eyebrow, heading, text, cta }: SectionProps<"use-cases-hero">) {
  return (
    <Section type="use-cases-hero" eyebrow={eyebrow} heading={heading} headingAs="h1">
      <p className="mb-6 max-w-prose">{text}</p>
      <Button href={site.links.contact} label={cta} />
    </Section>
  );
}
