import { Heading } from "@/components/ui/Heading";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";

/** The "why us" section: three points beside the screenshot the design draws. */
export function ChooseUs({ eyebrow, heading, points }: SectionProps<"use-cases-choose-us">) {
  return (
    <Section type="use-cases-choose-us" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="grid gap-4">
          {points.map((point) => (
            <Panel as="li" key={point.title} className={card}>
              <Heading as="h3">{point.title}</Heading>
              <p>{point.text}</p>
            </Panel>
          ))}
        </ul>
        <Placeholder ratio="aspect-[16/10]" label="platform screenshot" />
      </div>
    </Section>
  );
}
