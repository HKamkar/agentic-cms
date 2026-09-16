import type { SectionProps } from "@/components/sections/schemas";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 border border-ink p-4";

/** Three points beside the demo box, which carries the demo screenshot and the stats card under it. */
export function ChooseUs({ eyebrow, heading, items, demo, stats }: SectionProps<"home-choose-us">) {
  return (
    <Section type="home-choose-us" eyebrow={eyebrow} heading={heading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="grid gap-4">
          {items.map((item) => (
            <li key={item.title} className={card}>
              <img src={item.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border border-ink p-4">
          <h3>{demo.title}</h3>
          <img src={demo.image} width={800} height={400} alt={demo.imageAlt} loading="lazy" className="block h-auto w-full border border-ink" />
          <img src={stats.image} width={800} height={450} alt={stats.imageAlt} loading="lazy" className="block h-auto w-full border border-ink" />
        </div>
      </div>
    </Section>
  );
}
