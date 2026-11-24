import type { CtaHref, SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

/** The contact hero: the page's H1, one paragraph and the button, which points at this page. */
export function Hero({ eyebrow, heading, text, cta, ctaHref }: SectionProps<"contact-hero"> & CtaHref) {
  return (
    <Section type="contact-hero" eyebrow={eyebrow} heading={heading} headingAs="h1">
      <p className="mb-6 max-w-prose">{text}</p>
      <Button href={ctaHref} label={cta} />
    </Section>
  );
}
