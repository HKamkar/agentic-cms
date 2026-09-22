// The lab on this site's theme — a throwaway route: every scene under
// .parity/lab inline on the grounds below, read on every render (save a
// scene in the lab, refresh here), inside the site's real chrome. Written by
// `agentic-cms lab route`, removed by `agentic-cms lab clean`, never merged:
// the build's SEO audit fails a route without a seo block, which is the
// guard. The grounds are the site's own — add its surfaces (a card, a
// panel, a dark band) to GROUNDS, and keep them in a file of your own that
// this route imports, since `lab clean` deletes this file. The procedure on
// the page and the recipe are docs/lab.md § The route
// (node_modules/agentic-cms/docs/lab.md on a site that installs the kit).
import type { ReactNode } from "react";
import { LabScenes, type Ground } from "agentic-cms/lab";

export const metadata = { robots: { index: false } };

// Two grounds every site has: its page, and a white card. Inline styles on
// purpose — the route must render on any site's tokens without knowing them.
const GROUNDS: Ground[] = [
  { label: "the page", Frame: ({ children }: { children: ReactNode }) => <div style={{ border: "1px solid currentColor", padding: "2rem" }}>{children}</div> },
  { label: "white card", Frame: ({ children }: { children: ReactNode }) => <div style={{ background: "#ffffff", color: "#000000", border: "1px solid #000000", padding: "2rem" }}>{children}</div> },
];

export default function LabDemo() {
  return (
    <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem 4rem" }}>
      <LabScenes grounds={GROUNDS} />
    </main>
  );
}
