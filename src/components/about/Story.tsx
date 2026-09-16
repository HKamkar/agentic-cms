import { Placeholder } from "@/components/ui/Placeholder";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-ink p-4";
type Stat = SectionProps<"about-story">["sovereignty"];

/** A card that is a picture and the caption under it. */
function CaptionCard({ label, caption }: { label: string; caption: string }) {
  return (
    <li className={card}>
      <Placeholder ratio="aspect-square" label={label} className="w-24" />
      <p>{caption}</p>
    </li>
  );
}

/** A card that is a line, a figure and the line under the figure. */
function StatCard({ title, value, text }: Stat) {
  return (
    <li className={card}>
      <h3>{title}</h3>
      <p className="text-h1 font-semibold">{value}</p>
      <p>{text}</p>
    </li>
  );
}

/** "Our story": the statement, two captioned cards, two statistics and the figure card. */
export function Story({ eyebrow, statement, founded, sovereignty, compliance, partners, modalities }: SectionProps<"about-story">) {
  return (
    <Section type="about-story" eyebrow={eyebrow} heading={statement}>
      <ul className="grid gap-4 lg:grid-cols-3">
        <CaptionCard label="founded" caption={founded} />
        <StatCard {...sovereignty} />
        <StatCard {...compliance} />
        <CaptionCard label="partners" caption={partners} />
        <li className={card}>
          <h3>{modalities.heading}</h3>
          <Placeholder ratio="aspect-video" label="modalities" />
          <p className="text-h1 font-semibold">{modalities.stat}</p>
          <p>{modalities.text}</p>
        </li>
      </ul>
    </Section>
  );
}
