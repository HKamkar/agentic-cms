import type { ReactNode } from "react";

/** Items under a legend: a fieldset, spaced like the form it sits in. `min-w-0` undoes a fieldset's min-content width, which would push a phone's page sideways. */
export function FieldGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-6">
      <legend className="mb-4 text-h4 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}
