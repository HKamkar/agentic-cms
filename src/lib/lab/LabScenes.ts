// The lab inside the site: every scene under .parity/lab (and the folders
// given) inline on the site's own grounds — the frames the site passes, its
// page, its cards, its panels — at the scene's size and, for an icon-sized
// one, at the sizes given, read from the files on every render (next dev
// renders on every request: save in the lab, refresh here). `currentColor`
// is each ground's ink and the var() tokens resolve to the site's, because
// the drawing is inline in the site's own document; every copy's ids are
// its own, and a scene's classes and keyframes carry its name, so several
// scenes' styles coexist. Each scene is a study (LabStudy's previews): an
// animated one has its own timeline — one clock for all its copies, its own
// cycle, its own controls. It opens with the procedure for the person
// looking at it. A server component with no JSX (createElement), so it
// renders under node:test too; it reads the filesystem, which is why it
// lives at agentic-cms/lab and not beside the client components. The route
// that hosts it never merges: the build's SEO audit fails it, which is the
// guard.
import path from "node:path";
import { createElement as h, type ReactNode } from "react";
import { StudyPreviews, readStudy, type Ground, type Study } from "./LabStudy.ts";
import { LAB_DIR, listScenes } from "./scenes.ts";

export type { Ground };

export type LabScenesProps = {
  /** The surfaces to show every scene on, in order: the page, a card, a panel… */
  grounds: Ground[];
  /** The sizes an icon-sized scene (up to 96 px wide) is also shown at. */
  sizes?: number[];
  /** More scenes: files or folders under the site, like `lab serve --scenes`. */
  folders?: string[];
  /** The site's root (the process's directory). */
  root?: string;
  /** The procedure for the person looking at the page; `false` hides it. */
  intro?: boolean;
  /** The site's own note, after the procedure. */
  children?: ReactNode;
};

const ICON_SIZED = 96;
const label = (text: string) => h("p", { style: { fontSize: ".75rem", letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 .5rem" } }, text);
const mono = (text: string) => h("pre", { style: { font: ".8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", overflowX: "auto", margin: "1rem 0 0" } }, text);

const COMMANDS = `pnpm kit lab new <name> --kind icon|mark|loop    # a scene to start from
pnpm kit lab serve                               # the lab's page: light and dark, <img>, a timeline
pnpm kit lab render <name> --out public/images/<page>/<name>.svg
pnpm kit lab render <name> --out public/images/<page>/<name>.webp --animate   # a loop, with its still
pnpm kit lab render <name> --out src/config/icons/<name>.svg && pnpm kit icons add file:<name>
pnpm kit lab clean                               # the lab and this page`;

/** The procedure, brand-neutral, for the owner of the site. */
function Intro({ count }: { count: number }) {
  return h("header", { style: { maxWidth: "48rem", marginBottom: "2rem" } },
    h("h1", null, "The lab, on this site's theme"),
    h("p", null, `${count} scene${count === 1 ? "" : "s"} under ${LAB_DIR}/, each inline on the site's grounds, at its own size and — when it is icon-sized — at the small sizes too. Save a scene, refresh.`),
    h("p", null, h("strong", null, "A scene"), " is one SVG file under ", h("code", null, LAB_DIR), ", drawn on the site's tokens (", h("code", null, "currentColor"), ", ", h("code", null, "var(--color-*)"), ") with its animation inside it. It is not on the site until it is rendered."),
    h("p", null, h("strong", null, "Two windows."), " The lab's own page (", h("code", null, "pnpm kit lab serve"), ", on its port and the LAN address it prints) shows a scene in a light and a dark box and as the ", h("code", null, "<img>"), " a page would embed; this page shows it on the site's real grounds, next to the real chrome. Both give an animated scene a timeline: play or pause, replay, and a range over one cycle — drag it, or focus it and step with the arrow keys, 0.01 s a press."),
    h("p", null, h("strong", null, "The loop."), " Say what you want and where it goes; the agent draws two to four candidate scenes; pick one by its name on this page and ask for changes — the agent edits the file, you refresh. The pick ships pre-rendered: ", h("code", null, "lab render"), " writes the ", h("code", null, ".svg"), ", a still, or an animated ", h("code", null, ".webp"), " / ", h("code", null, ".webm"), " with its poster, or ", h("code", null, "icons add file:"), " turns it into inline Icon data; the agent places it in the section, proves the pages, and ", h("code", null, "lab clean"), " removes the lab and this page."),
    mono(COMMANDS),
  );
}

/** Every scene, read now: repository-owned files only, each keyed by its id. */
function read(root: string, folders: string[]): (Study & { id: string })[] {
  return [...listScenes(root, { extra: folders })].map(([id, file]) => ({ id, ...readStudy(root, path.relative(root, file), id) }));
}

function SceneRow({ scene, grounds, sizes }: { scene: Study & { id: string }; grounds: Ground[]; sizes: number[] }) {
  const small = scene.width <= ICON_SIZED && scene.height <= ICON_SIZED;
  // An icon-sized scene at every size once, its natural size among them, smallest first.
  const widths = small ? [...new Set([...sizes, scene.width])].sort((a, b) => a - b) : [scene.width];
  return h("section", { "data-scene": scene.id, style: { borderTop: "1px solid currentColor", padding: "2rem 0" } },
    h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: ".25rem 1.25rem", marginBottom: "1.25rem" } },
      h("h2", { style: { margin: 0 } }, scene.id),
      label(`${scene.file} · ${scene.width}×${scene.height}${small ? ` · at ${widths.join(" / ")} px` : ""}${scene.animated ? " · animated" : ""}`),
    ),
    h(StudyPreviews, { study: scene, grounds, widths, name: scene.id }),
  );
}

/** The scenes on the site's grounds, with the procedure; each animated scene under a timeline of its own. */
export function LabScenes({ grounds, sizes = [24, 40, 64], folders = [], root = process.cwd(), intro = true, children }: LabScenesProps) {
  const scenes = read(root, folders);
  return h("div", { "data-lab": "" },
    intro ? h(Intro, { count: scenes.length }) : null,
    children ?? null,
    scenes.length === 0 ? h("p", null, "No scenes yet: ", h("code", null, "pnpm kit lab new <name> --kind icon|mark|loop"), ".") : null,
    ...scenes.map((scene) => h(SceneRow, { key: scene.id, scene, grounds, sizes })),
  );
}
