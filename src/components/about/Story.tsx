import { Heading } from "@/components/ui/Heading";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";

/** "Our story": the statement, two captioned cards (a picture and the caption under it), two statistics between them (a line, a figure and the line under it) and the figure card. */
export function Story({ eyebrow, statement, founded, sovereignty, compliance, partners, modalities }: SectionProps<"about-story">) {
  return (
    <Section type="about-story" eyebrow={eyebrow} heading={statement}>
      <ul className="grid gap-4 lg:grid-cols-3">
        <Panel as="li" className={card}>
          <Placeholder ratio="aspect-square" label="founded" className="w-24" />
          <p>{founded}</p>
        </Panel>
        {[sovereignty, compliance].map((stat) => (
          <Panel as="li" key={stat.title} className={card}>
            <Heading as="h3">{stat.title}</Heading>
            <p className="text-h1 font-semibold">{stat.value}</p>
            <p>{stat.text}</p>
          </Panel>
        ))}
        <Panel as="li" className={card}>
          <Placeholder ratio="aspect-square" label="partners" className="w-24" />
          <p>{partners}</p>
        </Panel>
        <Panel as="li" className={card}>
          <Heading as="h3">{modalities.heading}</Heading>
          <Placeholder ratio="aspect-video" label="modalities" />
          <p className="text-h1 font-semibold">{modalities.stat}</p>
          <p>{modalities.text}</p>
        </Panel>
      </ul>
    </Section>
  );
}
