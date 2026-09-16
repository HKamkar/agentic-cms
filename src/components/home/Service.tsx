import type { SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

const card = "flex flex-col gap-2 border border-ink p-4";

/** A split section: the dashboard box on one side, one feature and the call to action on the other. */
export function Service({ eyebrow, heading, text, feature, cta, dashboard }: SectionProps<"home-service">) {
  return (
    <Section type="home-service" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2 border border-ink p-4">
          <h3>{dashboard.title}</h3>
          <p>{dashboard.text}</p>
          <img src={dashboard.image} width={1200} height={750} alt={dashboard.imageAlt} loading="lazy" className="block h-auto w-full border border-ink" />
        </div>
        <div>
          <div className={card}>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </div>
          <Button href={site.links.contact} label={cta} className="mt-4" />
        </div>
      </div>
    </Section>
  );
}
