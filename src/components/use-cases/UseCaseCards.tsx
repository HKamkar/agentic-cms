import { eyebrowText } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";
import type { UseCase } from "agentic-cms/content";

const card = "flex flex-col gap-2 p-4";

/** "Use cases": one card per entry of the use-case collection — its sector, its title, its line and its icon. */
export function UseCaseCards({ eyebrow, heading, cards }: SectionProps<"use-case-cards"> & { cards: UseCase[] }) {
  return (
    <Section type="use-case-cards" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((useCase) => (
          <Panel as="li" key={useCase.sector} className={card}>
            <p className={eyebrowText}>{useCase.sector}</p>
            <Heading as="h3">{useCase.title}</Heading>
            <p>{useCase.text}</p>
            <Media src={useCase.icon} width={64} height={64} alt="" size="icon" />
          </Panel>
        ))}
      </ul>
    </Section>
  );
}
