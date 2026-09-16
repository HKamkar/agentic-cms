import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-ink p-4";

/** "Own it": the copy, two cards and the button on one side, the analytics card the design draws on the other. */
export function ChooseUs({ eyebrow, heading, text, cards, cta }: SectionProps<"about-choose-us">) {
  return (
    <Section type="about-choose-us" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ul className="grid gap-4">
            {cards.map((point) => (
              <li key={point.title} className={card}>
                <img src={point.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </li>
            ))}
          </ul>
          <div>
            <Button href={site.links.contact} label={cta} />
          </div>
        </div>
        <Placeholder ratio="aspect-[4/3]" label="analytics card" />
      </div>
    </Section>
  );
}
