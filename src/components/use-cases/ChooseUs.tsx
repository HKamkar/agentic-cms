import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-ink p-4";

/** The "why us" section: three points beside the screenshot the design draws. */
export function ChooseUs({ eyebrow, heading, points }: SectionProps<"use-cases-choose-us">) {
  return (
    <Section type="use-cases-choose-us" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="grid gap-4">
          {points.map((point) => (
            <li key={point.title} className={card}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </li>
          ))}
        </ul>
        <Placeholder ratio="aspect-[16/10]" label="platform screenshot" />
      </div>
    </Section>
  );
}
