import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-ink p-4";

/** "The technology": the statement and the four cards under it, each one figure and one line. */
export function Vision({ eyebrow, statement, cards }: SectionProps<"use-cases-vision">) {
  return (
    <Section type="use-cases-vision" eyebrow={eyebrow} heading={statement}>
      <ul className="grid gap-4 lg:grid-cols-4">
        {cards.map((figure) => (
          <li key={figure.text} className={card}>
            <p className="text-h1 font-semibold">{figure.stat}</p>
            <p>{figure.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
