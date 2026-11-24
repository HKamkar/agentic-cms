# Steady frames: the code a story starts from

The pieces of a live scene that keep its frames steady, as code to copy
into the site and adapt. Why each exists, with its number, is
`docs/motion-story.md`. Raw WebGL 2, no library; with a library the same
rules hold, through its own settings.

## Geometry off the main thread

One self-contained function holds the maths and a generator that builds
every buffer, so its source can run in a worker or, where workers are not
allowed, on the main thread in slices.

```js
function Geo() {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)); // everything it needs is inside it
  function* run(small, count) { /* … */ yield; /* … */ return { points: new Float32Array(count * 4) }; }
  return { clamp, run };
}

function geometry(small, count) {
  return new Promise((done, fail) => {
    let used = false;
    const here = async () => {
      if (used) return; used = true;
      try {
        const it = Geo().run(small, count); let since = performance.now(), step;
        do { step = it.next(); if (performance.now() - since > 6) { await new Promise((r) => setTimeout(r)); since = performance.now(); } } while (!step.done);
        done(step.value);
      } catch (e) { fail(e); }
    };
    try {
      const src = `const G=(${Geo})();onmessage=(e)=>{const it=G.run(...e.data);let s;do s=it.next();while(!s.done);postMessage(s.value,Object.values(s.value).filter((v)=>v.buffer).map((v)=>v.buffer))}`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      w.onmessage = (e) => { if (!used) { used = true; done(e.data); w.terminate(); } };
      w.onerror = (e) => { e.preventDefault(); here(); };
      w.postMessage([small, count]);
    } catch { here(); }
  });
}
```

A seeded random generator inside it keeps every load, and every
screenshot, the same: one stream per scene, so a change to one scene cannot
shift the numbers of another.

```js
const stream = (name) => { let s = 2166136261; for (const c of name) s = Math.imul(s ^ c.charCodeAt(0), 16777619); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const tree = stream("tree"), storm = stream("storm"); // never one shared rnd()
```

## The first scene, then the rest

The generator yields the first scene's buffers as soon as they exist
(`yield { first: … }`), the worker posts them, and the page draws that scene
before anything else is compiled.

```js
G = await geo.first; world = await makeWorld(canvas, G); // the first scene's programs alone
world.draw(stateAt(position, 8), 1); await settled(); canvas.classList.add("lit");
geo.rest.then((R) => world.more(R)).then(warmOthers);    // behind it, while the reader is on it
// until world.full, a position past the first scene draws its last frame; the words go on
```

Under the canvas the stage carries the first scene's ground as CSS
gradients (its sky, its horizon, its one light), in the styles the server
sends.

## The context, and devices that should not run it

```js
const want = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" };
let weak = false, gl = canvas.getContext("webgl2", { ...want, failIfMajorPerformanceCaveat: true });
if (!gl) { weak = true; gl = canvas.getContext("webgl2", want); }
if (!gl) return null; // the words alone
const info = gl.getExtension("WEBGL_debug_renderer_info");
if (info && /swiftshader|llvmpipe|software|basic render/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) weak = true; // stills
```

Compile all, then ask: start every program, wait on
`KHR_parallel_shader_compile`'s `COMPLETION_STATUS_KHR`, and only then read
`LINK_STATUS` and the uniforms. A shader that does one of several jobs is
compiled once per job (`const int uKind = 3;` in the place of the uniform),
so nothing is decided on a pixel.

## Quality without new targets

```js
// made once, at the pixel budget
const dpr = Math.min(devicePixelRatio, 1.75, Math.sqrt(budget / (w * h)));
// every frame: how much of the targets is used
function fit(q) {
  let a = Math.round(W * q), b = Math.round(H * q);
  for (const t of targets) { // the picture, then each level of the glow
    t.a = Math.min(t.w, a); t.b = Math.min(t.h, b);
    t.s = [t.a / t.w, t.b / t.h, (t.a - .5) / t.w, (t.b - .5) / t.h];
    a = Math.max(2, a >> 1); b = Math.max(2, b >> 1);
  }
}
// in a shader that reads a target: texture(uTex, min(u * uS.xy + offset, uS.zw))
```

The glow, cheap: down from half size with five samples (the centre ×½, the
four corners ×⅛), up with four reads at ±.75 of a texel, adding into the
level above.

## Maths that is safe on every chip

At the top of every shader; the plain forms are not used below it.

```glsl
float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); } // smoothstep, either way round
float sq(float x) { return x * x; }
float rt(float x) { return sqrt(max(x, 1e-7)); }
float pw(float x, float y) { return pow(max(x, 1e-6), y); }
float hs(float n) { uint x = floatBitsToUint(n); x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return float(x >> 8) / 16777216.; } // 0..1, the same everywhere
```

## Uniforms without questions

```js
// names and types come from the source; only the place is asked for; one the compiler removed is a no-op
for (const [, type, list] of (vertex + fragment).matchAll(/\buniform (\w+) ([^;{(]+);/g)) for (const item of list.split(",")) {
  const [, name, size] = item.trim().match(/^(\w+)(?:\[(\d+)\])?$/), at = gl.getUniformLocation(program, name);
  set[name] ||= !at ? () => {} : type === "vec4" ? (size ? (v) => gl.uniform4fv(at, v) : (v) => gl.uniform4f(at, ...v)) : type === "float" ? (v) => gl.uniform1f(at, v) : /* … */ (v) => gl.uniform1i(at, v);
}
// a frame's shared values: uniform vec4 uFrame[14], one Float32Array, sent the first time a frame uses a program
const use = (p) => { gl.useProgram(p.program); if (p.stamp !== stamp) { p.stamp = stamp; p.set.uFrame(frameData); } return p.set; };
```

## A target this device can draw into

```js
const can = (format) => { const t = gl.createTexture(), f = gl.createFramebuffer(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, format, 4, 4); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.deleteFramebuffer(f); gl.deleteTexture(t); return ok; };
const wide = gl.getExtension("EXT_color_buffer_float"), half = gl.getExtension("EXT_color_buffer_half_float");
const format = wide && can(gl.R11F_G11F_B10F) ? gl.R11F_G11F_B10F : (wide || half) && can(gl.RGBA16F) ? gl.RGBA16F : gl.RGBA8;
```

## The scene taken away

```js
canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); gone = true; });
canvas.addEventListener("webglcontextrestored", async () => { world = await makeWorld(canvas, buffers); resize(); gone = false; });
```

## Noise as a texture

```glsl
uniform sampler3D uNoise; // 32³, R8, REPEAT, LINEAR, random bytes
float ns(vec3 p) { vec3 i = floor(p), f = p - i; f = f * f * (3. - 2. * f); return textureLod(uNoise, (i + f + .5) / 32., 0.).r; }
```

## Hairlines that stay one pixel

```glsl
float hair(float d, float px) { float w = max(fwidth(d), 1e-5); return 1. - ss(w * px * .5, w * (px * .5 + 1.), abs(d)); }
float lines(float x, float px) { float w = max(fwidth(x), 1e-5), d = abs(fract(x + .5) - .5); return (1. - ss(w * px * .5, w * (px * .5 + 1.), d)) * (1. - ss(.25, .6, w)); }
```

The last factor of `lines` fades a pattern out before it is finer than a
pixel. A line in space is a thin quad per segment, widened on screen in the
vertex shader to at least 1.3 px, its brightness lowered when it is thinner
than that.

## A solid thing that fades

```glsl
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
if (ign(gl_FragCoord.xy) > uPresence) discard; // a dissolve: no blending, no sorting; in a program of its own, used only while the thing fades
```

## The warm-up

```js
async function settled(limit = 1500) {
  const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t = performance.now(); gl.flush();
  while (performance.now() - t < limit) { const s = gl.clientWaitSync(f, 0, 0); if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) break; await new Promise((r) => setTimeout(r, 16)); }
  gl.deleteSync(f);
}
// draw(state, quality, unseen): unseen leaves out the last step, the one that writes to the canvas
const warm = async (chapter) => { for (const at of [middleOf(chapter), handOverOf(chapter)]) { draw(stateAt(at), .06, true); await settled(); } };
await warm(here); draw(stateAt(position), 1); await settled(); // then fade the scene in
for (const k of others) await warm(k);                         // while the reader is on the first one
```

## The governor

`idle` is the refresh measured with `requestAnimationFrame` while the page
loads, before anything is drawn: in Safari it is 33 ms in low power mode.
`gpuTime()` is the running mean of `EXT_disjoint_timer_query_webgl2`'s
`TIME_ELAPSED_EXT`, one query in flight, results dropped when
`GPU_DISJOINT_EXT`; 0 where the extension is missing (Safari), and then the
frame times alone decide. Frames longer than 2 s (a hidden tab) are left out.
It holds no clock and no DOM, so a test can run it on simulated devices.

```js
function governor(gpuTime, small, idle) {
  const RATES = [6.94, 8.33, 11.11, 16.67, 33.33], snap = (x) => RATES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const min = small ? .46 : .42, start = small ? .78 : .86; let q = start, cap = 1, dts = [], sum = 0, period = snap(idle || 16.67), good = 0, half = false, skip = false, capAt = -1e9, detail = 1, hopeless = 0, ref = null, hold = 0, capped = 0, probe = null, wait = 20000;
  const lower = (f, now) => { q = Math.max(min, q * f); cap = Math.min(cap, q * 1.06); capAt = now; good = 0; };
  return {
    get q() { return q; }, get half() { return half; }, get period() { return period; }, get detail() { return detail; }, get hopeless() { return hopeless > 4; },
    /** false when this refresh should be skipped to hold an even half rate */
    tick() { if (!half) return true; skip = !skip; return !skip; },
    frame(dt, now) {
      dts.push(dt); sum += dt; if (dts.length < 24 && (sum < 900 || dts.length < 4)) return;
      const s = dts.sort((a, b) => a - b), at = (f) => s[Math.floor(s.length * f)], p25 = at(.25), p50 = at(.5), p75 = at(.72); dts = []; sum = 0;
      if (!half && p25 < period * .72) { period = snap(p25); ref = null; capped = 0; } // the limit was lifted
      const step = period * (half ? 2 : 1), budget = Math.min(Math.max(step, 11), 16.7) * .62, gpu = gpuTime(), over = p75 > step * 1.3, heavy = gpu ? gpu > budget * 1.1 : over;
      if (p75 > 90) { q = min; detail = .55; hopeless += 2; return; }
      if (now < hold) return;
      if (probe) { // one window at the smallest picture: faster means the picture was the cause, the same means it was not
        const faster = p50 < probe.p50 * .93; if (faster) { q = min + (probe.q - min) * .45; cap = q * 1.06; capAt = now; } else { q = Math.max(probe.from, start); cap = 1; hold = now + 6000; if (probe.limit) { period = 33.33; half = false; } else detail = .55; } probe = null; ref = null; good = 0; return;
      }
      if (over && !heavy) { // late, and the graphics card is not why
        if (p50 < 35.5 && p50 > period * 1.5 && p75 - p25 < 6) { if (++capped > 2) { period = 33.33; half = false; capped = 0; q = Math.max(q, start); cap = 1; } } else if (++capped > 3) detail = .55; return;
      }
      if (over && !gpu) { // no timer here: did a smaller picture help? If not, the picture is not the cause
        if (!ref) ref = { q, p50 };
        else if (q < ref.q * .8) { if (p50 > ref.p50 * .93) { probe = { q, from: ref.q, p50, limit: p50 < 35.5 && p50 > period * 1.5 && p75 - p25 < 6 }; q = min; return; } ref = { q, p50 }; }
      } else if (!over) { ref = null; capped = 0; }
      if (q <= min + .001 && p75 > Math.max(42, step * 1.3)) { detail = .55; hopeless++; } else hopeless = Math.max(0, hopeless - 2);
      if (heavy) { lower(gpu ? clamp(Math.sqrt(budget / gpu), .8, .96) : .9, now); if (q < .6 && period < 11 && !half) { half = true; q = .8; cap = 1; ref = null; } }
      else if (++good > (gpu ? 2 : 8) && (!gpu || gpu < budget * .72)) { if (now - capAt > wait && cap < 1) { cap = 1; wait = Math.min(wait * 2, 160000); } q = Math.max(q, Math.min(cap, q * 1.04)); good = 0; }
    },
  };
}
```

## The words

```js
const set = (el, opacity, y = 0) => {
  const a = Math.round(opacity * 100), b = Math.round(y * 2);
  if (el._a !== a) { if (!a !== !el._a || el._a === undefined) el.style.visibility = a ? "" : "hidden"; el._a = a; el.style.opacity = a / 100; }
  if (a && el._b !== b) { el._b = b; el.style.transform = `translate3d(0,${b / 2}px,0)`; }
};
```

A card hangs on a point of the scene. It picks its side once, when it
appears, and keeps it; the camera has made its turn before that.

```js
if (!card.shown) { card.w = card.el.lastElementChild.offsetWidth + gap; card.left = wantsLeft ? p.x > card.w : innerWidthNow - p.x < card.w + margin; card.shown = true; }
const clear = 1 - smooth(.72, .79, p.y / h) * smooth(captionRight + 24, captionRight - 24, card.left ? p.x - card.w : p.x); // gone under the caption
```

`will-change: transform, opacity` through the class of the chapter on
screen; what has faded out is hidden, so it has no layer. No `filter`, no large `text-shadow`, no custom property written on
`<html>`, no read of layout: a `ResizeObserver` keeps the sizes.

## The loop

```js
function frame(ms) {
  if (over) return; requestAnimationFrame(frame);
  if (document.hidden || !onScreen || gone) { last = ms; return; }
  if (!gov.tick()) return;
  const raw = ms - last, dt = Math.min(.05, raw / 1000); last = ms;
  if (raw < 2000) gov.frame(Math.min(raw, 400), ms); if (gov.hopeless) { over = true; return stills(); }
  position += (goal - position) * (1 - Math.exp(-dt * 6.5)); // by time, so a late frame is not a jump
  const s = stateAt(position, ms / 1000); s.share = gov.detail; draw(s, gov.q); words(s);
}
```

`stateAt(position, time)` is a pure function of the scroll position and the
time: the same frame can be drawn again for a screenshot, a still or a
measurement.
