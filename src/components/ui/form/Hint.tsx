import { cx } from "agentic-cms/cx";

/** A field's help text: under its label, joined to the control by aria-describedby. */
export function Hint({ id, text, className }: { id: string; text?: string; className?: string }) {
  if (!text) return null;
  return (
    <p id={hintId(id)} className={cx(className, "text-muted")}>
      {text}
    </p>
  );
}

export const hintId = (id: string) => `${id}-hint`;

/** The control's aria-describedby: the hint's id when there is one. */
export const describedBy = (id: string, hint?: string) => (hint ? hintId(id) : undefined);
