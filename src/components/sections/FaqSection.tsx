import { Faq, type FaqEntry } from "@/components/ui/Faq";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

type Props = SectionProps<"faq"> & { items: FaqEntry[] };

/**
 * The FAQ section of a page: the accordion of the FAQ set the page names.
 * The design variant the page asked for is printed under the title block,
 * because the wireframe draws both variants the same way: a wireframe note,
 * aria-hidden like a `TypeTag`, not copy.
 */
export function FaqSection({ eyebrow, heading, variant, items }: Props) {
  return (
    <Section type="faq" eyebrow={eyebrow} heading={heading}>
      <p aria-hidden="true" className="mb-4 text-muted">variant: {variant}</p>
      <Faq items={items} />
    </Section>
  );
}
