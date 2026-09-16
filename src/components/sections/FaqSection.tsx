import { Faq, type FaqEntry } from "@/components/ui/Faq";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

type Props = SectionProps<"faq"> & { items: FaqEntry[] };

/**
 * The FAQ section of a page: the accordion of the FAQ set the page names.
 * The design variant the page asked for is copy here, printed under the
 * title block, because the wireframe draws both variants the same way.
 */
export function FaqSection({ eyebrow, heading, variant, items }: Props) {
  return (
    <Section type="faq" eyebrow={eyebrow} heading={heading}>
      <p className="mb-4 text-muted">variant: {variant}</p>
      <Faq items={items} />
    </Section>
  );
}
