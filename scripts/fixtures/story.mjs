// A motion story of two scenes, small enough to read: raw WebGL 2, its words
// in the HTML, two cards, a still version, the hook `agentic-cms story` draws
// with. `storyPage()` keeps every rule; `storyPage("<rule>")` breaks that one
// and nothing else, each the way a real story breaks it.
const VERTEX = `#version 300 es
layout(location=0)in vec2 q;out vec2 u;void main(){u=q*.5+.5;gl_Position=vec4(q,0.,1.);}`;
// a disc of light over a horizon; the scene and the time move it
const FRAGMENT = (scene) => `#version 300 es
precision highp float;in vec2 u;out vec4 o;uniform vec4 uS;void main(){vec2 p=(u-.5)*vec2(uS.z,1.);float d=length(p-vec2(sin(uS.y*.2)*.3,.1));
vec3 sky=mix(vec3(.02,.03,.09),vec3(.05,.16,.4),smoothstep(.55,.0,abs(p.y)));float disc=smoothstep(.13,.12,d);
o=vec4(sky+disc*${scene ? "vec3(1.,.7,.35)" : "vec3(.75,.85,1.)"}*(.6+.4*uS.x),1.);}`;

const ENGINE = (broken) => `
const BROKEN = ${JSON.stringify(broken)}, test = window.__storyTest, calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (q) => document.querySelector(q), track = $("[data-story]"), stage = $("[data-story-stage]"), canvas = $("canvas"), cards = [...document.querySelectorAll("[data-story-card]")];
const SCENES = [{ id: "one", from: 0, to: 1.6 }, { id: "two", from: 2, to: 3.6 }], LENGTH = 4, SAFARI = !navigator.userAgent.includes("Chrome");
const gl = canvas.getContext("webgl2", { antialias: false });
let programs = [], buffer = null, gone = false, shown = true, hits = 0;
function program(scene) {
  const p = gl.createProgram();
  for (const [type, text] of [[gl.VERTEX_SHADER, ${JSON.stringify(VERTEX)}], [gl.FRAGMENT_SHADER, scene ? ${JSON.stringify(FRAGMENT(1))} : ${JSON.stringify(FRAGMENT(0))}]]) { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); gl.attachShader(p, s); }
  gl.linkProgram(p); gl.useProgram(p);
  return { p, at: gl.getUniformLocation(p, "uS") };
}
function build() {
  buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  programs = [program(0)];
}
function size() {
  const w = innerWidth, h = innerHeight, small = w < 760, budget = small ? 9e5 : matchMedia("(pointer: coarse)").matches ? 1.3e6 : 1.9e6;
  const scale = BROKEN === "pixels" ? devicePixelRatio : Math.min(devicePixelRatio, Math.sqrt(budget / (w * h)));
  canvas.width = Math.floor(w * scale); canvas.height = Math.floor(h * scale); gl.viewport(0, 0, canvas.width, canvas.height);
}
const clamp = (x) => Math.min(1, Math.max(0, x));
function words(at) {
  SCENES.forEach((s, i) => {
    const local = clamp((at - s.from) / (s.to - s.from)), el = cards[i], on = local > .3 && at < s.to + .1, w = innerWidth, h = innerHeight;
    let x = w * .3 - local * 30, y = h * .4;
    if (BROKEN === "cards" && i) x += local * w * .4;
    if (BROKEN === "cards-window") y = h - 20;
    if (BROKEN === "cards-side" && local > .6) x += 220;
    el.style.opacity = on && !(BROKEN === "cards-unseen" && i) ? 1 : 0; el.style.transform = "translate3d(" + x + "px," + y + "px,0)";
  });
}
function render(at, seconds) {
  if (gone) return;
  if (BROKEN === "shift" && at > 2 && !hits++) { const box = document.createElement("div"); box.style.height = "500px"; document.querySelector("#two").append(box); }
  const scene = at < 1.8 ? 0 : 1, s = programs[scene];
  if (BROKEN === "mid-scroll-made") gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  if (BROKEN === "mid-scroll-asked") gl.getUniformLocation(s.p, "uS");
  if (BROKEN === "blank" && scene) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } else {
    gl.useProgram(s.p); gl.uniform4f(s.at, clamp((at - SCENES[scene].from) / 1.6), seconds, (innerWidth / innerHeight) * (BROKEN === "engines" && SAFARI ? .4 : 1), 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  words(at);
}
const at = () => clamp(scrollY / (track.offsetHeight - innerHeight)) * LENGTH;
function loop(ms) { requestAnimationFrame(loop); if ((document.hidden && BROKEN !== "stops-hidden") || (!shown && BROKEN !== "stops-away")) return; render(at(), ms / 1000); }
async function start() {
  if (calm && BROKEN !== "still") return; // the words as a document, the drawn ground behind them
  document.documentElement.dataset.mode = "story";
  if (BROKEN === "errors") console.error("a shader did not compile");
  if (BROKEN === "setup") { const end = performance.now() + 400; while (performance.now() < end) hits++; }
  build(); size();
  if (BROKEN === "first-picture") for (let i = 0; i < 20; i++) program(0);
  render(at(), 0); canvas.style.opacity = 1; performance.mark("story:first-picture");
  programs.push(program(1));
  if (BROKEN === "words") { const p = document.createElement("p"); p.textContent = "A line only the script knows."; $("#two").append(p); }
  canvas.addEventListener("webglcontextlost", (e) => { if (BROKEN !== "lost") e.preventDefault(); gone = true; });
  canvas.addEventListener("webglcontextrestored", () => { if (BROKEN === "lost-picture") { programs = []; return; } build(); programs.push(program(1)); size(); gone = false; });
  new IntersectionObserver((seen) => { shown = seen[0].isIntersecting; }).observe(track);
  const ready = new Promise((done) => { if (BROKEN !== "hook-ready") setTimeout(done, 150); });
  if (test && BROKEN !== "hook") window.__story = { length: LENGTH, scenes: BROKEN === "hook-scenes" ? [] : SCENES, ready, render };
  if (!test || test.loop || calm) requestAnimationFrame(loop);
}
start();`;

const STYLE = (broken) => `body{margin:0;font:16px/1.4 sans-serif;color:#eee;background:#030510}[data-story-stage]{${broken === "first-picture-ground" ? "background:#030510" : "background:linear-gradient(#030510 40%,#0c2a66 52%,#030510)"};min-height:100vh}
canvas{display:none}section{padding:12vh 2rem}[data-mode=story] [data-story]{height:500vh}[data-mode=story] [data-story-stage]{position:sticky;top:0;height:100vh;overflow:clip}[data-mode=story] canvas{display:block;position:absolute;inset:0;width:100%;height:100%;opacity:0}
[data-mode=story] section{position:absolute;bottom:0;left:0;padding:2rem}[data-story-card]{display:none}[data-mode=story] [data-story-card]{display:block;position:absolute;left:0;top:0;width:150px;padding:8px;opacity:0;border:1px solid}${broken === "words-hidden" ? "#two{opacity:0}" : ""}`;

const SCENE = (id, title, line) => `<section id="${id}"><h2>${title}</h2><p>${line}</p></section>`;

/** The story as a page; \`broken\` names the one thing wrong with it. */
export const storyPage = (broken = null) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A story</title><style>${STYLE(broken)}</style></head>
<body><main><div data-story><div data-story-stage><canvas aria-hidden="true"></canvas>${SCENE("one", "The first scene", "A light stands over a dark sea, and waits.")}${SCENE("two", "The second scene", "The light turns warm, and the sea is bright.")}
<div aria-hidden="true"><div data-story-card>A card</div><div data-story-card>Another card</div></div></div></div></main><script>${ENGINE(broken)}</script></body></html>`;
