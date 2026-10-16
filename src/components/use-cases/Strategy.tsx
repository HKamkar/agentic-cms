import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";

/** "What you keep": two cards and the button, beside the stack of analytics cards the design draws. */
export function Strategy({ eyebrow, heading, cards, cta }: SectionProps<"use-cases-strategy">) {
  return (
    <Section type="use-cases-strategy" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ul className="grid gap-4">
            {cards.map((point) => (
              <Panel as="li" key={point.title} className={card}>
                <Heading as="h3">{point.title}</Heading>
                <p>{point.text}</p>
              </Panel>
            ))}
          </ul>
          <div>
            <Button href={site.links.contact} label={cta} />
          </div>
        </div>
        <Placeholder ratio="aspect-[4/3]" label="analytics stack" />
      </div>
    </Section>
  );
}
