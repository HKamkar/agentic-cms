import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { cx } from "content-engine-kit/cx";

/**
 * One section of a page, drawn as a labelled box. `type` is the section type
 * from the page file (or a page's own tag, e.g. "post-hero"): it names the
 * box on screen, so a reader of the wireframe can see which component renders
 * what, and it is the section's id and `data-section`, which is how the
 * capture harness finds it.
 */
export function Section({ type, eyebrow, heading, headingAs = "h2", className, children }: { type: string; eyebrow?: string; heading?: ReactNode; headingAs?: "h1" | "h2"; className?: string; children?: ReactNode }) {
  const titled = Boolean(eyebrow) || Boolean(heading);
  return (
    <section id={type} data-section={type} className={cx("py-section", className)}>
      <Container>
        <div className="border border-ink p-6 max-md:p-4">
          <span aria-hidden="true" className="mb-4 inline-block border border-ink bg-fill px-2 font-label text-h6">
            {type}
          </span>
          {titled && (
            <div className="mb-6 flex flex-col gap-2">
              {eyebrow && <Eyebrow label={eyebrow} className="self-start" />}
              {heading && <Heading as={headingAs}>{heading}</Heading>}
            </div>
          )}
          {children}
        </div>
      </Container>
    </section>
  );
}
