// The lab's pages as HTML strings, on the site's tokens and nothing of the
// site's design: the bare page (one scene alone, in one scheme — what the
// scene page frames and what a render photographs), the scene page (the
// scene inline in a light and a dark box at its sizes, the same file as an
// <img> on both grounds, a scrubber over its animations, a reload on every
// save) and the index. The in-page seek and the controls are the package's
// (src/lib/lab/api.ts), shared with the LabScenes route inside a site and
// used by `lab render`.
import { LAB_API, LAB_CONTROLS_HTML, labControls, svgMarkup, tagRoot } from "agentic-cms/lab";
import { escape } from "./sheet.mjs";
import { tokensCss } from "./lab.mjs";

export { LAB_API };
const FONT = "var(--font-sans, system-ui, sans-serif)";
const LABEL = "var(--font-label, ui-monospace, monospace)";

/** One scene alone: inline, in one scheme, on a transparent ground (or the paper), at an explicit size, with the seek API. */
export function bareHtml(scene, svg, { tokens = {}, scheme = "light", background = "transparent", width, height, pad = 0 } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(scene)}</title>
<style>
${tokensCss(tokens)}
html { background: transparent; }
body { margin: 0; padding: ${Number(pad) || 0}px; display: inline-block; color-scheme: ${scheme === "dark" ? "dark" : "light"}; background: ${background === "paper" ? "var(--color-paper)" : "transparent"}; color: var(--color-ink); }
svg.lab-scene { display: block; width: ${Number(width)}px; height: ${Number(height)}px; }
</style></head>
<body>${tagRoot(svgMarkup(svg).trim(), "lab-scene")}
<script>${LAB_API}</script></body></html>`;
}

const PAGE_CSS = `
html { background: var(--color-paper); color: var(--color-ink); font: 14px/1.5 ${FONT}; }
body { margin: 0; padding: 20px 24px; }
a { color: inherit; }
header { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
h1 { font: 600 16px/1.3 ${FONT}; margin: 0; }
h2 { font: 500 13px/1.3 ${LABEL}; margin: 28px 0 8px; }
.lab-note, .lab-label { font: 12px/1.4 ${LABEL}; color: var(--color-muted); }
.lab-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
.lab-box { border: 1px solid var(--color-ink); background: var(--color-paper); color: var(--color-ink); padding: 8px; }
.lab-box[data-scheme="light"] { color-scheme: light; }
.lab-box[data-scheme="dark"] { color-scheme: dark; }
.lab-box img, iframe.lab-frame { display: block; border: 0; }
.lab-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; font: 12px/1.3 ${LABEL}; }
.lab-controls button { font: inherit; border: 1px solid var(--color-ink); background: var(--color-paper); color: var(--color-ink); padding: 2px 10px; cursor: pointer; }
.lab-controls input[type="range"] { width: min(360px, 60vw); }
table { border-collapse: collapse; }
td, th { text-align: left; vertical-align: top; padding: 8px 16px 8px 0; border-bottom: 1px solid var(--color-ink); }
th { font: 500 12px/1.3 ${LABEL}; }
code { font: 12px/1.4 ${LABEL}; }`;

const shell = (title, tokens, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)} · lab</title>
<style>
${tokensCss(tokens)}
${PAGE_CSS}
</style></head>
<body>${body}</body></html>`;

const box = (scheme, inner) => `<div class="lab-box" data-scheme="${scheme}">${inner}</div>`;
const sizeOf = (meta, width) => ({ width, height: Math.max(1, Math.round((width * meta.height) / meta.width)) });
const encode = (id) => id.split("/").map(encodeURIComponent).join("/");

/** The scene page: inline in both schemes at the natural size and the given sizes (framed bare pages), as an <img> on both grounds, the scrubber, the render hint. */
export function sceneHtml(scene, { file, meta, tokens = {}, sizes = [], animated = true } = {}) {
  const widths = [...new Set([meta.width, ...sizes])].filter((w) => w > 0).sort((a, b) => a - b);
  const label = (w) => `${w} px${w === meta.width ? " (natural)" : ""}`;
  const frame = (scheme, width) => {
    const { height } = sizeOf(meta, width);
    return `<iframe class="lab-frame" title="${escape(scene)} ${scheme} ${width}px" src="/scene/${encode(scene)}?bare=1&scheme=${scheme}&background=paper&width=${width}&pad=8" width="${width + 16}" height="${height + 16}"></iframe>`;
  };
  const inline = widths.map((w) => `<div class="lab-row"><span class="lab-label">${label(w)}</span>${box("light", frame("light", w))}${box("dark", frame("dark", w))}</div>`).join("");
  const image = (w) => `<img src="/files/${encode(scene)}.svg" width="${w}" height="${sizeOf(meta, w).height}" alt="">`;
  const asImg = widths.map((w) => `<div class="lab-row"><span class="lab-label">${label(w)}</span>${box("light", image(w))}${box("dark", image(w))}</div>`).join("");
  return shell(scene, tokens, `<header><h1><a href="/">lab</a> / ${escape(scene)}</h1><span class="lab-note">${escape(file)} · ${meta.width}×${meta.height}${meta.duration ? ` · ${meta.duration}s` : ""}</span></header>
<h2>inline — currentColor and var(--color-*) follow each box's scheme</h2>
${animated ? LAB_CONTROLS_HTML : ""}
${inline}
<h2>as &lt;img&gt; — the file as a page would embed it: currentColor is black, a var() without a fallback is the initial paint, the scheme is the browser's (a render to .svg resolves the tokens)</h2>
${asImg}
<p class="lab-note">pnpm kit lab render ${escape(scene)} --out public/images/&lt;page&gt;/${escape(scene.split("/").pop())}.svg · --out ….webp [--fps 30] · pnpm kit lab clean</p>
<script>${animated ? labControls({ frames: true, duration: meta.duration }) : ""}new EventSource("/events").onmessage = () => location.reload();</script>`);
}

/** The index: every scene by name and file, as an <img> on both grounds, linked to its page. */
export function indexHtml(scenes, { tokens = {}, metas = new Map() } = {}) {
  const rows = [...scenes].map(([id, file]) => {
    const meta = metas.get(id);
    const thumb = (scheme) => box(scheme, `<img src="/files/${encode(id)}.svg" width="64" height="${meta ? sizeOf(meta, 64).height : 64}" alt="">`);
    return `<tr><td><a href="/scene/${encode(id)}">${escape(id)}</a></td><td class="lab-note">${escape(file)}${meta ? ` · ${meta.width}×${meta.height}${meta.duration ? ` · ${meta.duration}s` : ""}` : ""}</td><td><div class="lab-row">${thumb("light")}${thumb("dark")}</div></td></tr>`;
  });
  const body = rows.length ? `<table><tr><th>scene</th><th>file</th><th>as &lt;img&gt;</th></tr>${rows.join("")}</table>` : `<p>No scenes yet.</p>`;
  return shell("scenes", tokens, `<header><h1>lab</h1><span class="lab-note">${scenes.size} scene(s)</span></header>
${body}
<p class="lab-note">pnpm kit lab new &lt;name&gt; --kind icon|mark|loop · pnpm kit lab serve --scenes public/images/&lt;page&gt; · pnpm kit lab render &lt;name&gt; --out &lt;file&gt; · pnpm kit lab clean</p>
<script>new EventSource("/events").onmessage = () => location.reload();</script>`);
}
