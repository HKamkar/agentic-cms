import type { CtaHref, SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 p-4";

/** Two cards and a call to action beside the illustration: the section that names what the reader gives up. */
export function Automation({ eyebrow, heading, cta, cards, ctaHref }: SectionProps<"home-automation"> & CtaHref) {
  return (
    <Section type="home-automation" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <ul className="grid gap-4">
            {cards.map((entry) => (
              <Panel as="li" key={entry.title} className={card}>
                <Media src={entry.icon} width={64} height={64} alt="" size="icon" />
                <Heading as="h3">{entry.title}</Heading>
                <p>{entry.text}</p>
              </Panel>
            ))}
          </ul>
          <Button href={ctaHref} label={cta} className="mt-4" />
        </div>
        <Placeholder ratio="aspect-square" label="globe" />
      </div>
    </Section>
  );
}
