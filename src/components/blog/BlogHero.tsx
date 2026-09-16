import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";

/**
 * The hero of the blog index, and the 404 page's frame: a section box whose
 * heading is the page's H1, with whatever the page puts under it.
 */
export function BlogHero({ type, label, title, children }: { type: string; label: string; title: string; children?: ReactNode }) {
  return (
    <Section type={type} eyebrow={label} heading={title} headingAs="h1">
      {children}
    </Section>
  );
}
