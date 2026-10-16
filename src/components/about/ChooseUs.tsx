import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";

/** "Own it": the copy, two cards and the button on one side, the analytics card the design draws on the other. */
export function ChooseUs({ eyebrow, heading, text, cards, cta }: SectionProps<"about-choose-us">) {
  return (
    <Section type="about-choose-us" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ul className="grid gap-4">
            {cards.map((point) => (
              <Panel as="li" key={point.title} className={card}>
                <Media src={point.icon} width={64} height={64} alt="" size="icon" />
                <Heading as="h3">{point.title}</Heading>
                <p>{point.text}</p>
              </Panel>
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
