import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-ink p-4";

/** "What you get": three benefit cards, each an icon, a title and a line. */
export function Benefits({ eyebrow, heading, cards }: SectionProps<"about-benefits">) {
  return (
    <Section type="about-benefits" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((benefit) => (
          <li key={benefit.title} className={card}>
            <img src={benefit.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
            <h3>{benefit.title}</h3>
            <p>{benefit.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
