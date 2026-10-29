import type { CtaHref, SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 p-4";

/** A split section: the dashboard box on one side, one feature and the call to action on the other. */
export function Service({ eyebrow, heading, text, feature, cta, dashboard, ctaHref }: SectionProps<"home-service"> & CtaHref) {
  return (
    <Section type="home-service" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="grid gap-2 p-4">
          <Heading as="h3">{dashboard.title}</Heading>
          <p>{dashboard.text}</p>
          <Media src={dashboard.image} width={1200} height={750} alt={dashboard.imageAlt} />
        </Panel>
        <div>
          <Panel className={card}>
            <Heading as="h3">{feature.title}</Heading>
            <p>{feature.text}</p>
          </Panel>
          <Button href={ctaHref} label={cta} className="mt-4" />
        </div>
      </div>
    </Section>
  );
}
