import { eyebrowText } from "@/components/ui/Eyebrow";
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
            <h3>{useCase.title}</h3>
            <p>{useCase.text}</p>
            <img src={useCase.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-line" />
          </Panel>
        ))}
      </ul>
    </Section>
  );
}
