/** One box or radio with its label beside it: the browser's own control, tinted to the one ink colour. */
export function Choice({ type, id, name, value, label, checked, required }: { type: "checkbox" | "radio"; id: string; name: string; value: string; label: string; checked?: boolean; required?: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input type={type} id={id} name={name} value={value} defaultChecked={checked} required={required} className="size-4 accent-ink" />
      {label}
    </label>
  );
}
