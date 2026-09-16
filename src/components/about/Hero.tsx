import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

/* Three cards is what the design shows under the copy; the page file says nothing about them. */
const CARDS = ["first", "second", "third"];

/** The About hero: the page's H1 and its paragraph, over the row of cards the design draws. */
export function Hero({ eyebrow, heading, text }: SectionProps<"about-hero">) {
  return (
    <Section type="about-hero" eyebrow={eyebrow} heading={heading} headingAs="h1">
      <p className="mb-6 max-w-prose">{text}</p>
      <ul className="grid gap-4 lg:grid-cols-3">
        {CARDS.map((card) => (
          <li key={card}>
            <Placeholder ratio="aspect-[4/3]" label="card" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
