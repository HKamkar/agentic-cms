import type { SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

const card = "flex flex-col gap-2 border border-ink p-4";

/** Two cards and a call to action beside the illustration: the section that names what the reader gives up. */
export function Automation({ eyebrow, heading, cta, cards }: SectionProps<"home-automation">) {
  return (
    <Section type="home-automation" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <ul className="grid gap-4">
            {cards.map((entry) => (
              <li key={entry.title} className={card}>
                <img src={entry.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
                <h3>{entry.title}</h3>
                <p>{entry.text}</p>
              </li>
            ))}
          </ul>
          <Button href={site.links.contact} label={cta} className="mt-4" />
        </div>
        <Placeholder ratio="aspect-square" label="globe" />
      </div>
    </Section>
  );
}
