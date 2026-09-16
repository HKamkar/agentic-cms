"use client";

import { useId, useState } from "react";

export type FaqEntry = { question: string; answer: string };

type Props = {
  items: FaqEntry[];
};

/** The FAQ list: every answer starts collapsed and its question discloses it. */
export function Faq({ items }: Props) {
  return (
    <ul>
      {items.map((item) => (
        <FaqItem key={item.question} {...item} />
      ))}
    </ul>
  );
}

function FaqItem({ question, answer }: FaqEntry) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return (
    <li className="border-t border-ink">
      <h3>
        <button type="button" className="flex w-full items-center justify-between gap-4 py-3 text-left" aria-expanded={open} aria-controls={answerId} onClick={() => setOpen((value) => !value)}>
          {question}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h3>
      {/* Preflight already hides [hidden]; no class decides whether the answer is there. */}
      <div id={answerId} hidden={!open}>
        <p className="pb-3">{answer}</p>
      </div>
    </li>
  );
}
