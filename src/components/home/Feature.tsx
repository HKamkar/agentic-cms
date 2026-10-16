import type { SectionProps } from "@/components/sections/schemas";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 p-4";

/** Five cards beside the tall screenshot: what the build does before a page ships. */
export function Feature({ eyebrow, heading, text, cards, monitoring }: SectionProps<"home-feature">) {
  return (
    <Section type="home-feature" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2-1">
        <ul className="grid gap-4 lg:grid-cols-2">
          {cards.map((entry) => (
            <Panel as="li" key={entry.title} className={card}>
              <Media src={entry.icon} width={64} height={64} alt="" size="icon" />
              <Heading as="h3">{entry.title}</Heading>
              <p>{entry.text}</p>
            </Panel>
          ))}
        </ul>
        <Media src={monitoring.image} width={600} height={1200} alt={monitoring.imageAlt} />
      </div>
    </Section>
  );
}
