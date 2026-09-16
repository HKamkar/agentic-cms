import type { SectionProps } from "@/components/sections/schemas";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 border border-ink p-4";

/** The statement that says what the site is, over three cards that each carry one figure. */
export function About({ eyebrow, statement, cards }: SectionProps<"home-about">) {
  return (
    <Section type="home-about" eyebrow={eyebrow} heading={statement}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((entry) => (
          <li key={entry.title} className={card}>
            <h3>{entry.title}</h3>
            <p className="text-h1 font-semibold">{entry.stat}</p>
            <p>{entry.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
