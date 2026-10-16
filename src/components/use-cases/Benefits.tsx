import { Media } from "@/components/ui/Media";
import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";

/** "Why it works": two benefits on each side of the dashboard the design draws, each an icon and the line it belongs to. */
export function Benefits({ eyebrow, heading, left, right }: SectionProps<"use-cases-benefits">) {
  const [first, second] = [left, right].map((benefits, side) => (
    <ul key={side} className="grid gap-4">
      {benefits.map((benefit) => (
        <Panel as="li" key={benefit.text} className={card}>
          <Media src={benefit.icon} width={64} height={64} alt="" size="icon" />
          <p className="font-medium">{benefit.text}</p>
        </Panel>
      ))}
    </ul>
  ));
  return (
    <Section type="use-cases-benefits" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-1-2-1">
        {first}
        <Placeholder ratio="aspect-[16/10]" label="dashboard" />
        {second}
      </div>
    </Section>
  );
}
