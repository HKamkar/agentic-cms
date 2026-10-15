import { Placeholder } from "@/components/ui/Placeholder";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 p-4";
type Benefit = SectionProps<"use-cases-benefits">["left"];

/** One side of the row: two benefits, each an icon and the line it belongs to. */
function BenefitList({ benefits }: { benefits: Benefit }) {
  return (
    <ul className="grid gap-4">
      {benefits.map((benefit) => (
        <Panel as="li" key={benefit.text} className={card}>
          <img src={benefit.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-line" />
          <p className="font-medium">{benefit.text}</p>
        </Panel>
      ))}
    </ul>
  );
}

/** "Why it works": two benefits on each side of the dashboard the design draws. */
export function Benefits({ eyebrow, heading, left, right }: SectionProps<"use-cases-benefits">) {
  return (
    <Section type="use-cases-benefits" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr_1fr]">
        <BenefitList benefits={left} />
        <Placeholder ratio="aspect-[16/10]" label="dashboard" />
        <BenefitList benefits={right} />
      </div>
    </Section>
  );
}
