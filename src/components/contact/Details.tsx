import { EmailLink } from "agentic-cms/components";
import { encodeEmail } from "agentic-cms/email";
import { Fragment } from "react";
import type { SectionProps } from "@/components/sections/schemas";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";

const card = "flex flex-col gap-2 p-4";

/** "Reach us": the section box and its three detail cards — an icon, a title, the card's lines and a highlight, which is plain text or an e-mail address as a link. */
export function Details({ eyebrow, heading, cards }: SectionProps<"contact-details">) {
  return (
    <Section type="contact-details" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((entry) => (
          <Panel as="li" key={entry.title} className={card}>
            <Media src={entry.icon} width={64} height={64} alt="" size="icon" />
            <Heading as="h3">{entry.title}</Heading>
            <p>
              {entry.text.map((line, n) => (
                <Fragment key={n}>
                  {n > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </p>
            {entry.highlight.kind === "email" ? <EmailLink token={encodeEmail(entry.highlight.value)} /> : <p className="font-medium">{entry.highlight.value}</p>}
          </Panel>
        ))}
      </ul>
    </Section>
  );
}
