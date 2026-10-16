import type { SectionProps } from "@/components/sections/schemas";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 p-4";

/** Three points beside the demo box, which carries the demo screenshot and the stats card under it. */
export function ChooseUs({ eyebrow, heading, items, demo, stats }: SectionProps<"home-choose-us">) {
  return (
    <Section type="home-choose-us" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="grid gap-4">
          {items.map((item) => (
            <Panel as="li" key={item.title} className={card}>
              <Media src={item.icon} width={64} height={64} alt="" size="icon" />
              <Heading as="h3">{item.title}</Heading>
              <p>{item.text}</p>
            </Panel>
          ))}
        </ul>
        <Panel className="grid gap-2 p-4">
          <Heading as="h3">{demo.title}</Heading>
          <Media src={demo.image} width={800} height={400} alt={demo.imageAlt} />
          <Media src={stats.image} width={800} height={450} alt={stats.imageAlt} />
        </Panel>
      </div>
    </Section>
  );
}
