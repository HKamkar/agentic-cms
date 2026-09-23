// The lab's pages as HTML strings, on the site's tokens and nothing of the
// site's design: the bare page (one scene alone, in one scheme — what the
// scene page frames and what a render photographs), the scene page (the
// scene inline in a light and a dark box at its sizes and enlarged, the same
// file as an <img> on both grounds, a scrubber and a replay over its
// animations, a switch to its still, a reload on every save) and the index. The in-page seek and the controls are the package's
// (src/lib/lab/api.ts), shared with the LabScenes route inside a site and
// used by `lab render`.
import { LAB_API, LAB_CONTROLS_HTML, labControls, svgMarkup, tagRoot } from "agentic-cms/lab";
import { escape } from "./sheet.mjs";
import { tokensCss } from "./lab.mjs";

export { LAB_API };
const FONT = "var(--font-sans, system-ui, sans-serif)";
const LABEL = "var(--font-label, ui-monospace, monospace)";

/** One scene alone: inline, in one scheme, on a transparent ground (or the paper), at an explicit size or (`fit`) the frame's width, with the seek API. */
export function bareHtml(scene, svg, { tokens = {}, scheme = "light", background = "transparent", width, height, pad = 0, fit = false } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(scene)}</title>
<style>
${tokensCss(tokens)}
html { background: transparent; }
body { margin: 0; padding: ${Number(pad) || 0}px; display: ${fit ? "block" : "inline-block"}; color-scheme: ${scheme === "dark" ? "dark" : "light"}; background: ${background === "paper" ? "var(--color-paper)" : "transparent"}; color: var(--color-ink); }
svg.lab-scene { display: block; ${fit ? "width: 100%; height: auto;" : `width: ${Number(width)}px; height: ${Number(height)}px;`} }
</style></head>
<body>${tagRoot(svgMarkup(svg).trim(), "lab-scene")}
<script>${LAB_API}</script></body></html>`;
}

/** The widest the enlarged view gets; below it, it fits the screen (a phone). */
export const ENLARGED = 640;

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
.lab-enlarged .lab-label { flex-basis: 100%; }
.lab-enlarged .lab-box { flex: 1 1 240px; min-width: 0; max-width: ${ENLARGED + 18}px; }
.lab-enlarged iframe.lab-frame { width: 100%; height: auto; }
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

// Replay: the scrubber back to 0 and playing, and every <img> moved to one
// new URL — an animated image restarts only as a new image. One URL for all
// copies keeps them sharing one image, as a page that embeds the file at
// several sizes does, so a shared-image repaint problem stays visible.
const REPLAY_JS = `(() => {
  const button = document.getElementById("lab-replay");
  if (!button) return;
  let count = 0;
  button.onclick = () => {
    count += 1;
    for (const img of document.querySelectorAll("img.lab-img")) img.src = img.src.replace(/\\?.*$/, "") + "?replay=" + count;
    const range = document.getElementById("lab-time"), toggle = document.getElementById("lab-toggle");
    if (!range) return;
    range.value = 0;
    range.dispatchEvent(new Event("input"));
    if (toggle.textContent === "play") toggle.click();
  };
})();`;

const box = (scheme, inner) => `<div class="lab-box" data-scheme="${scheme}">${inner}</div>`;
const sizeOf = (meta, width) => ({ width, height: Math.max(1, Math.round((width * meta.height) / meta.width)) });
const encode = (id) => id.split("/").map(encodeURIComponent).join("/");

/** The scene page: inline in both schemes at the natural size, the given sizes and enlarged (framed bare pages), as an <img> on both grounds, the scrubber and the replay, the animated / still switch (`still`: every copy without its animation), the render hint. */
export function sceneHtml(scene, { file, meta, tokens = {}, sizes = [], animated = true, still = false } = {}) {
  const moving = animated && !still;
  const stillQuery = still ? "&still=1" : "";
  const widths = [...new Set([meta.width, ...sizes])].filter((w) => w > 0).sort((a, b) => a - b);
  const label = (w) => `${w} px${w === meta.width ? " (natural)" : ""}`;
  const bare = (scheme, rest) => `/scene/${encode(scene)}?bare=1&scheme=${scheme}&background=paper&${rest}${stillQuery}`;
  const frame = (scheme, width) => {
    const { height } = sizeOf(meta, width);
    return `<iframe class="lab-frame" title="${escape(scene)} ${scheme} ${width}px" src="${bare(scheme, `width=${width}&pad=8`)}" width="${width + 16}" height="${height + 16}"></iframe>`;
  };
  const inline = widths.map((w) => `<div class="lab-row"><span class="lab-label">${label(w)}</span>${box("light", frame("light", w))}${box("dark", frame("dark", w))}</div>`).join("");
  const big = (scheme) => `<iframe class="lab-frame" title="${escape(scene)} ${scheme} enlarged" src="${bare(scheme, "fit=1")}" style="aspect-ratio: ${meta.width} / ${meta.height}"></iframe>`;
  const enlarged = Math.max(...widths) < ENLARGED ? `<div class="lab-row lab-enlarged"><span class="lab-label">enlarged, up to ${ENLARGED} px</span>${box("light", big("light"))}${box("dark", big("dark"))}</div>` : "";
  const image = (w) => `<img class="lab-img" src="/files/${encode(scene)}.svg${still ? "?still=1" : ""}" width="${w}" height="${sizeOf(meta, w).height}" alt="">`;
  const asImg = widths.map((w) => `<div class="lab-row"><span class="lab-label">${label(w)}</span>${box("light", image(w))}${box("dark", image(w))}</div>`).join("");
  const page = `/scene/${encode(scene)}`;
  const mode = still ? `<a href="${page}">animated</a> · <strong>still</strong>` : `<strong>animated</strong> · <a href="${page}?still=1">still</a>`;
  const bar = animated ? `<div class="lab-controls"><span>${mode}</span>${moving ? `<button id="lab-replay" type="button" title="restarts the inline scenes and moves every &lt;img&gt; to one new URL, so they still share one image, as on a page">replay</button>` : ""}</div>` : "";
  return shell(scene, tokens, `<header><h1><a href="/">lab</a> / ${escape(scene)}</h1><span class="lab-note">${escape(file)} · ${meta.width}×${meta.height}${meta.duration ? ` · ${meta.duration}s` : ""}</span></header>
${still ? `<p class="lab-note">still — every copy without its animation: the -still.svg a render writes beside a loop, the &lt;picture&gt;'s fallback, what a reduced-motion reader gets</p>` : ""}
<h2>inline — currentColor and var(--color-*) follow each box's scheme</h2>
${bar}
${moving ? LAB_CONTROLS_HTML : ""}
${inline}
${enlarged}
<h2>as &lt;img&gt; — the file as a page would embed it: currentColor is black, a var() without a fallback is the initial paint, the scheme is the browser's (a render to .svg resolves the tokens)</h2>
${asImg}
<p class="lab-note">pnpm kit lab render ${escape(scene)} --out public/images/&lt;page&gt;/${escape(scene.split("/").pop())}.svg · --out ….webp [--fps 30] · pnpm kit lab clean</p>
<script>${moving ? labControls({ frames: true, duration: meta.duration }) + REPLAY_JS : ""}new EventSource("/events").onmessage = () => location.reload();</script>`);
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
