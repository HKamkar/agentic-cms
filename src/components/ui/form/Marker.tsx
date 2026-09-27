/** The form's optional marker after a label: inside the label, so it is read as part of the name; secondary text. */
export function Marker({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <>
      {" "}
      <span className="text-muted">{text}</span>
    </>
  );
}
