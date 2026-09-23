// One animation study on a route — a design round's demo route, or the
// lab's (LabScenes renders one per scene): an SVG the site's repository
// owns, inline at the sizes it ships at on each ground the route passes,
// every copy with ids of its own, all of them under one LabTimeline — one
// clock, so every copy shows the same frame, and a range to stop on any of
// them. Inline because an animated file inside an <img> cannot be driven
// from the page; the file itself stays what ships, offered as a download,
// with the still a render wrote beside it. The cycle is read from the
// file (data-duration, else its SMIL and CSS), never restated. A server
// component: it reads the file, which is why it lives at agentic-cms/lab.
import fs from "node:fs";
import path from "node:path";
import { createElement as h, type ComponentType, type ReactNode } from "react";
import { LabTimeline } from "./LabTimeline.ts";
import { animates, namespaceIds, readTrustedSvg, sceneDuration, sceneMeta, svgMarkup, tagRoot } from "./scenes.ts";

/** A ground of the site: a label and a component that wraps children in that surface. */
export type Ground = { label: string; Frame: ComponentType<{ children: ReactNode }> };

export type LabStudyProps = {
  /** An SVG the site's repository owns, relative to its root: `public/images/home/mark.svg`, `.parity/lab/mark-a.svg`. */
  file: string;
  /** The study's name on the page and its timeline's (default: the file's name). */
  label?: string;
  /** The widths it ships at; its natural width is always shown too. */
  sizes?: number[];
  /** The surfaces to show it on (default: the page as it is). */
  grounds?: Ground[];
  /** A link that downloads the original file (default: yes). */
  download?: boolean;
  /** The site's root (default: the process's directory). */
  root?: string;
};

/** A scene read for a study: its markup and what the route needs to know about it. */
export type Study = { key: string; file: string; text: string; markup: string; width: number; height: number; duration: number; animated: boolean };

const PAGE: Ground[] = [{ label: "the page", Frame: ({ children }: { children: ReactNode }) => h("div", null, children) }];
const label = (text: string) => h("p", { style: { fontSize: ".75rem", letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 .5rem" } }, text);

/** The file read and checked (repository-owned, no code in it); `key` names its copies' ids. */
export function readStudy(root: string, file: string, key = file): Study {
  const text = readTrustedSvg(root, file);
  const { width, height } = sceneMeta(text);
  const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
  return { key: key.replace(/\.svg$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(), file: rel, text, markup: svgMarkup(text).trim(), width, height, duration: sceneDuration(text), animated: animates(text) };
}

/** One copy at one width, inline, its root sized explicitly and its ids its own. */
function copy(study: Study, width: number, n: number) {
  const height = Math.max(1, Math.round((width * study.height) / study.width));
  const markup = namespaceIds(tagRoot(study.markup, "lab-scene", { width, height }), `lab-${study.key}-${n}`);
  return h("span", { key: n, style: { display: "inline-block", lineHeight: 0 }, dangerouslySetInnerHTML: { __html: markup } });
}

/** Every copy of a study — each ground, each width — and, when it animates, all of them under one timeline. */
export function StudyPreviews({ study, grounds, widths, name }: { study: Study; grounds: Ground[]; widths: number[]; name: string }) {
  let n = 0;
  const grid = h("div", { style: { display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))" } },
    ...grounds.map(({ label: ground, Frame }) => h("div", { key: ground, "data-ground": ground },
      label(ground),
      h(Frame, null, h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "2rem" } }, ...widths.map((width) => copy(study, width, n++)))),
    )),
  );
  return study.animated ? h(LabTimeline, { label: name, duration: study.duration }, grid) : grid;
}

/** The public URL of a file under public/, else null. */
const publicUrl = (file: string): string | null => (file.startsWith("public/") ? `/${file.slice("public/".length)}` : null);

/** The still a render wrote beside the file (`<name>-still.svg` or `.webp`), as the <picture> would show it, when it is served. */
function shippedStill(root: string, study: Study) {
  const still = [".svg", ".webp"].map((ext) => study.file.replace(/\.svg$/, `-still${ext}`)).find((f) => fs.existsSync(path.join(root, f)));
  const src = still && publicUrl(still);
  if (!src) return null;
  return h("figure", { style: { margin: 0 } }, label("still, as shipped — the <picture>'s fallback, what a reduced-motion reader gets"), h("img", { src, width: study.width, height: study.height, alt: "", loading: "lazy", style: { display: "block", maxWidth: "100%", height: "auto" } }));
}

/** A link that downloads the original file: its public URL, or the file's own text for one that is not served. */
function downloadLink(study: Study) {
  const href = publicUrl(study.file) ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(study.text)}`;
  const name = path.basename(study.file);
  return h("a", { href, download: name, "data-lab-download": "" }, `Download ${name}`);
}

/** One study: the file inline at its sizes on the grounds under one timeline, its still and its download. */
export function LabStudy({ file, label: name, sizes = [], grounds = PAGE, download = true, root = process.cwd() }: LabStudyProps) {
  // Two studies of one file on one page differ by label, and so do their copies' ids.
  const study = readStudy(root, file, name ? `${file}-${name}` : file);
  const title = name ?? path.basename(file, ".svg");
  const widths = [...new Set([...sizes, study.width])].filter((w) => w > 0).sort((a, b) => a - b);
  return h("section", { "data-study": study.key, style: { borderTop: "1px solid currentColor", padding: "2rem 0", display: "grid", gap: "1.25rem" } },
    h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: ".25rem 1.25rem" } },
      h("h2", { style: { margin: 0 } }, title),
      label(`${study.file} · ${study.width}×${study.height} · at ${widths.join(" / ")} px${study.animated ? ` · ${study.duration ? `${study.duration.toFixed(2)} s cycle` : "animated"}` : ""}`),
    ),
    h(StudyPreviews, { study, grounds, widths, name: title }),
    shippedStill(root, study),
    download ? h("p", { style: { margin: 0 } }, downloadLink(study)) : null,
  );
}
