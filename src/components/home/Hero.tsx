import type { SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

/** The landing hero: the page's H1, the paragraph under it, one call to action and the board that stands in for the product shot. */
export function Hero({ eyebrow, heading, text, cta }: SectionProps<"home-hero">) {
  return (
    <Section type="home-hero" eyebrow={eyebrow} heading={heading} headingAs="h1">
      <p className="mb-6 max-w-prose">{text}</p>
      <Button href={site.links.contact} label={cta} />
      <Placeholder ratio="aspect-video" label="hero board" className="mt-6" />
    </Section>
  );
}
