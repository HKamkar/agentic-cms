import type { FormNote as FormNoteDefinition } from "agentic-cms/forms";

/** A line of text inside the form, its link at the end; it submits nothing. */
export function FormNote({ note }: { note: FormNoteDefinition }) {
  return (
    <p>
      {note.note}
      {note.link && (
        <>
          {" "}
          <a href={note.link.href}>{note.link.label}</a>
        </>
      )}
    </p>
  );
}
