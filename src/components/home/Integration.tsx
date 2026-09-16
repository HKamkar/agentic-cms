import type { SectionProps } from "@/components/sections/schemas";
import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";

/** The heading over the diagram that stands in for how the product fits an existing stack. */
export function Integration({ eyebrow, heading }: SectionProps<"home-integration">) {
  return (
    <Section type="home-integration" eyebrow={eyebrow} heading={heading}>
      <Placeholder ratio="aspect-[2/1]" label="integration diagram" />
    </Section>
  );
}
