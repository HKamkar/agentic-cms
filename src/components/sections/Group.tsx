import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import type { SectionOf } from "@/components/sections/schemas";

type Props = { variant: SectionOf<"group">["variant"]; children: ReactNode };

/**
 * A wrapper around several sections, drawn as a dashed box that names the
 * variant. The sections inside keep their own frames, so the inset doubles:
 * that is how a reader sees which of them the wrapper holds.
 */
export function Group({ variant, children }: Props) {
  return (
    <Container>
      <div className="border border-dashed border-ink" data-section={`group-${variant}`}>
        <span aria-hidden="true" className="m-4 inline-block border border-ink bg-fill px-2 font-label text-h6">
          group · {variant}
        </span>
        {children}
      </div>
    </Container>
  );
}
