import type { SectionProps } from "@/components/sections/schemas";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 border border-ink p-4";

/** Five cards beside the tall screenshot: what the build does before a page ships. */
export function Feature({ eyebrow, heading, text, cards, monitoring }: SectionProps<"home-feature">) {
  return (
    <Section type="home-feature" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ul className="grid gap-4 lg:grid-cols-2">
          {cards.map((entry) => (
            <li key={entry.title} className={card}>
              <img src={entry.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
              <h3>{entry.title}</h3>
              <p>{entry.text}</p>
            </li>
          ))}
        </ul>
        <img src={monitoring.image} width={600} height={1200} alt={monitoring.imageAlt} loading="lazy" className="block h-auto w-full border border-ink" />
      </div>
    </Section>
  );
}
