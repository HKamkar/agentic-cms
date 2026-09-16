import { Fragment } from "react";
import type { SectionProps } from "@/components/sections/schemas";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 border border-ink p-4";

type Card = SectionProps<"contact-details">["cards"][number];

/** The highlighted line under a card's text: plain text, or an e-mail address as a link. */
function Highlight({ kind, value }: Card["highlight"]) {
  return kind === "email" ? <a href={`mailto:${value}`}>{value}</a> : <p className="font-medium">{value}</p>;
}

/** "Reach us": the section box and its three detail cards — an icon, a title, the card's lines and a highlight. */
export function Details({ eyebrow, heading, cards }: SectionProps<"contact-details">) {
  return (
    <Section type="contact-details" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((entry) => (
          <li key={entry.title} className={card}>
            <img src={entry.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-ink" />
            <h3>{entry.title}</h3>
            <p>
              {entry.text.map((line, n) => (
                <Fragment key={n}>
                  {n > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </p>
            <Highlight {...entry.highlight} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
