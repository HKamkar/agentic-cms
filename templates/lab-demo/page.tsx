// The lab on this site's theme — a throwaway route: every scene under
// .parity/lab inline on the grounds below, read on every render (save a
// scene in the lab, refresh here), inside the site's real chrome. Written by
// `agentic-cms lab route`, removed by `agentic-cms lab clean`, never merged:
// the build's SEO audit fails a route without a seo block, which is the
// guard. The grounds are LabScenes' own two (LAB_GROUNDS: the page, a white
// card) until the site passes its own surfaces (a card, a panel, a dark
// band) as `grounds={[...LAB_GROUNDS, ...]}` — kept in a file of your own
// that this route imports, since `lab clean` deletes this file. The
// procedure on the page and the recipe are docs/lab.md § The route
// (node_modules/agentic-cms/docs/lab.md on a site that installs the kit).
import { LabScenes } from "agentic-cms/lab";
import { kit } from "@/kit";

export const metadata = kit.seo.unlistedMetadata();

export default function LabDemo() {
  return (
    // Inside the site's root layout (its theme, its chrome, its <main>): a div, not a second <main>.
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem 4rem" }}>
      <LabScenes />
    </div>
  );
}
