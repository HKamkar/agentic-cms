import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Panel } from "@/components/ui/Panel";
import { TypeTag } from "@/components/ui/TypeTag";
import { cx } from "agentic-cms/cx";

/**
 * One section of a page, drawn as a labelled `Panel`. `type` is the section
 * type from the page file (or a page's own tag, e.g. "post-hero"): it names
 * the box on screen, so a reader of the wireframe can see which component
 * renders what, and it is the section's id and `data-section`, which is how
 * the capture harness finds it.
 */
export function Section({ type, eyebrow, heading, headingAs = "h2", className, children }: { type: string; eyebrow?: string; heading?: ReactNode; headingAs?: "h1" | "h2"; className?: string; children?: ReactNode }) {
  const titled = Boolean(eyebrow) || Boolean(heading);
  return (
    <section id={type} data-section={type} className={cx("py-section", className)}>
      <Container>
        <Panel className="p-6 max-md:p-4">
          <TypeTag label={type} className="mb-4" />
          {titled && (
            <div className="mb-6 flex flex-col gap-2">
              {eyebrow && <Eyebrow label={eyebrow} className="self-start" />}
              {heading && <Heading as={headingAs}>{heading}</Heading>}
            </div>
          )}
          {children}
        </Panel>
      </Container>
    </section>
  );
}
