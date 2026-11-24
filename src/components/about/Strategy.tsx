import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import type { CtaHref, SectionProps } from "@/components/sections/schemas";

/** "How we build": the copy, the list of beliefs and the button, beside the board the design draws. */
export function Strategy({ eyebrow, heading, text, beliefsHeading, beliefs, cta, ctaHref }: SectionProps<"about-strategy"> & CtaHref) {
  return (
    <Section type="about-strategy" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Placeholder ratio="aspect-[4/3]" label="dashboard" />
        <div className="flex flex-col gap-4">
          <Heading as="h3">{beliefsHeading}</Heading>
          <ul className="list-disc pl-5">
            {beliefs.map((belief) => (
              <li key={belief}>{belief}</li>
            ))}
          </ul>
          <div>
            <Button href={ctaHref} label={cta} />
          </div>
        </div>
      </div>
    </Section>
  );
}
