import { smooth, TAU, K, NS, NP, NG } from "./geo.js";
import { SH } from "./shaders.js";

// ---------- the renderer ----------
export async function makeWorld(canvas, G, opts) {
  let since = performance.now();
  const rest = async (force) => {
    if (force || performance.now() - since > 6) {
      await new Promise((r) => setTimeout(r));
      since = performance.now();
    }
  };
  const want = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" };
  let weak = false,
    gl = canvas.getContext("webgl2", { ...want, failIfMajorPerformanceCaveat: !opts.soft });
  if (!gl) {
    weak = true;
    gl = canvas.getContext("webgl2", want);
  }
  const info = gl && !opts.soft && gl.getExtension("WEBGL_debug_renderer_info");
  if (info && /swiftshader|llvmpipe|software|basic render/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) weak = true;
  if (!gl) return null;
  const wide = gl.getExtension("EXT_color_buffer_float"),
    half = gl.getExtension("EXT_color_buffer_half_float");
  gl.getExtension("EXT_float_blend");
  const prog = {},
    FIRST = ["back", "neb", "star", "water", "core", "points", "boat", "disc2", "disc6", "down", "up", "out"];
  const par = gl.getExtension("KHR_parallel_shader_compile");
  async function compile(names) {
    for (const name of names) {
      const p = gl.createProgram();
      for (const [n, type] of [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].entries()) {
        const s = gl.createShader(type);
        gl.shaderSource(s, SH[name][n]);
        gl.compileShader(s);
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      prog[name] = { p, s: {} };
      await rest();
    }
    for (const name of names) {
      const q = prog[name];
      if (par) for (let i = 0; i < 900 && !gl.getProgramParameter(q.p, par.COMPLETION_STATUS_KHR); i++) await new Promise((r) => setTimeout(r, 4));
      if (!gl.getProgramParameter(q.p, gl.LINK_STATUS))
        throw new Error(name + ": " + gl.getProgramInfoLog(q.p) + (gl.getAttachedShaders(q.p) || []).map((s) => gl.getShaderInfoLog(s)).join("\n"));
      gl.useProgram(q.p);
      for (const [, type, list] of SH[name].join("\n").matchAll(/\buniform (\w+) ([^;{(]+);/g))
        for (const item of list.split(",")) {
          const [, k, size] = item.trim().match(/^(\w+)(?:\[(\d+)\])?$/),
            l = gl.getUniformLocation(q.p, k),
            many = !!size;
          if (!l) {
            q.s[k] ||= () => {};
            continue;
          }
          q.s[k] =
            type === "float"
              ? many
                ? (v) => gl.uniform1fv(l, v)
                : (v) => gl.uniform1f(l, v)
              : type === "vec2"
                ? (x, y) => gl.uniform2f(l, x, y)
                : type === "vec3"
                  ? many
                    ? (v) => gl.uniform3fv(l, v)
                    : (v) => gl.uniform3f(l, v[0], v[1], v[2])
                  : type === "vec4"
                    ? many
                      ? (v) => gl.uniform4fv(l, v)
                      : (v) => gl.uniform4f(l, v[0], v[1], v[2], v[3])
                    : (v) => gl.uniform1i(l, v);
        }
      if (q.s.uNoise) q.s.uNoise(3);
      if (CONST[name]) for (const [k, v] of Object.entries(CONST[name])) q.s[k](Array.isArray(v) ? v.flat() : v);
      await rest();
    }
  }
  // constants are set once, not every frame
  const P = opts.palette,
    CONST = {
      points: { uA: P.a, uB: P.b, uC: P.c, uPow: P.pow, uForm: 0 },
      streams: { uSc: P.sc, uSh: P.sh, uSp: P.sp, uRest: P.rest, uLine: 0, uWidth: 0.012 },
      panels: { uGc: P.gc, uGp: P.gp, uPane: 0 },
      out: { uTex: 0, uBloom: 1 },
      down: { uTex: 0 },
      up: { uTex: 0, uGain: 0.82 },
      back: { uTex: 0 },
    };
  await compile(FIRST);
  const layers = (w, h, n) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA32F, w, h, n);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, gl.NEAREST);
    return t;
  };
  gl.activeTexture(gl.TEXTURE0);
  const fill = (t, k, w, h, data) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, w, h, 1, gl.RGBA, gl.FLOAT, data);
  };
  const N = G.count,
    tForm = layers(256, G.rows, K),
    tLine = layers(NP, NS, K),
    tPane = layers(NG, 2, K);
  fill(tForm, 0, 256, G.rows, G.form);
  fill(tLine, 0, NP, NS, G.line);
  fill(tPane, 0, NG, 2, G.pane);
  await rest();
  gl.activeTexture(gl.TEXTURE3);
  const tNoise = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tNoise);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8, 32, 32, 32);
  gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, 32, 32, 32, gl.RED, gl.UNSIGNED_BYTE, G.noise);
  for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, k, gl.LINEAR);
  for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
  gl.activeTexture(gl.TEXTURE0);
  const buf = (data, type = gl.ARRAY_BUFFER) => {
    const b = gl.createBuffer();
    gl.bindBuffer(type, b);
    gl.bufferData(type, data, gl.STATIC_DRAW);
    return b;
  };
  const vao = (...parts) => {
    const v = gl.createVertexArray();
    gl.bindVertexArray(v);
    for (const [b, stride, step, ...at] of parts) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      for (const [loc, n, off] of at) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, off * 4);
        gl.vertexAttribDivisor(loc, step);
      }
    }
    return v;
  };
  const f32 = (a) => new Float32Array(a),
    bQuad = buf(f32([-1, -1, 1, -1, -1, 1, 1, 1]));
  const vStar = vao([buf(G.stars), 4, 0, [0, 4, 0]]);
  const vQuad = vao([bQuad, 2, 0, [0, 2, 0]]),
    vPts = vao([buf(G.order), 1, 0, [0, 1, 0]]);
  const strip = [];
  for (let i = 0; i < NP; i++) strip.push(i, -1, i, 1);
  const vStrip = vao([buf(f32(strip)), 2, 0, [0, 2, 0]]);
  const ringV = [];
  for (let i = 0; i <= 128; i++) ringV.push(i / 128, 0, i / 128, 1);
  const vRing = vao([buf(f32(ringV)), 2, 0, [0, 2, 0]]);
  const grid = (w, h) => {
    const v = [],
      ix = [];
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) v.push(i / w, j / h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const a = j * (w + 1) + i;
        ix.push(a, a + 1, a + w + 1, a + 1, a + w + 2, a + w + 1);
      }
    const o = vao([buf(f32(v)), 2, 0, [0, 2, 0]]);
    buf(new Uint16Array(ix), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindVertexArray(null);
    return { v: o, n: ix.length };
  };
  const gWater = grid(96, 110),
    gBody = grid(72, 72),
    gFin = grid(18, 6);
  const vBoat = vao([buf(G.boatMesh), 8, 0, [0, 4, 0], [1, 4, 4]], [buf(G.fleet), 4, 1, [2, 4, 0]]),
    nBoat = G.boatMesh.length / 8,
    nFleet = G.fleet.length / 4;
  gl.bindVertexArray(null);
  await rest();
  // the rest, put on the card in slices behind the first scene
  let full = false,
    gSurf,
    vSph,
    nSph,
    segs,
    vLeaf,
    nLeaf,
    vBark,
    nBark,
    vCurt;
  async function more(R) {
    await compile(Object.keys(SH).filter((n) => !prog[n]));
    for (let k = 1; k < K; k++) {
      fill(tForm, k, 256, G.rows, R.form[k - 1]);
      await rest();
      fill(tLine, k, NP, NS, R.line[k - 1]);
      fill(tPane, k, NG, 2, R.pane[k - 1]);
      await rest();
    }
    gSurf = grid(160, 40);
    await rest();
    const sph = [],
      SU = 96,
      SV = 64,
      sp = (i, j) => {
        const a = (i / SU) * TAU,
          b = (j / SV) * Math.PI;
        return [Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b)];
      };
    for (let j = 0; j < SV; j++)
      for (let i = 0; i < SU; i++) sph.push(...sp(i, j), ...sp(i + 1, j), ...sp(i, j + 1), ...sp(i + 1, j), ...sp(i + 1, j + 1), ...sp(i, j + 1));
    vSph = vao([buf(f32(sph)), 3, 0, [0, 3, 0]]);
    nSph = sph.length / 3;
    await rest();
    segs = [];
    for (const d of R.segs) {
      segs.push({ n: d.length / 13, v: d.length ? vao([bQuad, 2, 0, [0, 2, 0]], [buf(d), 13, 1, [1, 4, 0], [2, 4, 4], [3, 4, 8], [4, 1, 12]]) : null });
      await rest();
    }
    const leafQ = [];
    for (let i = 0; i <= 5; i++) for (const x of [-1, 1]) leafQ.push(x, i / 2.5 - 1);
    vLeaf = vao([buf(f32(leafQ)), 2, 0, [0, 2, 0]], [buf(R.leaves), 10, 1, [1, 4, 0], [2, 4, 4], [3, 2, 8]]);
    nLeaf = R.leaves.length / 10;
    await rest();
    vBark = vao([buf(R.bark.v), 10, 0, [0, 4, 0], [1, 4, 4], [2, 2, 8]]);
    buf(R.bark.ix, gl.ELEMENT_ARRAY_BUFFER);
    gl.bindVertexArray(null);
    nBark = R.bark.ix.length;
    vCurt = grid(150, 6);
    gl.bindVertexArray(null);
    await rest(true);
    full = true;
  }
  // the frame's shared values: one array, sent once to each program a frame uses
  const fb = new Float32Array(56),
    dd = new Float32Array(24);
  let stamp = 0;
  let W = 0,
    HH = 0,
    hdr,
    mips = [],
    vw = 1,
    vh = 1;
  const can = (f) => {
    const t = gl.createTexture(),
      fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, f, 4, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(t);
    return ok;
  };
  const FMT = wide && can(gl.R11F_G11F_B10F) ? gl.R11F_G11F_B10F : (wide || half) && can(gl.RGBA16F) ? gl.RGBA16F : gl.RGBA8;
  const target = (w, h, depth) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, FMT, w, h);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let r = null;
    if (depth) {
      r = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, r);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, r);
    }
    return { t, f, r, w, h, a: w, b: h, s: [1, 1, 1, 1] };
  };
  const free = (x) => {
    if (!x) return;
    gl.deleteTexture(x.t);
    gl.deleteFramebuffer(x.f);
    if (x.r) gl.deleteRenderbuffer(x.r);
  };
  const neb = target(256, 144);
  function size(w, h) {
    if (w === W && h === HH) return;
    W = w;
    HH = h;
    canvas.width = w;
    canvas.height = h;
    free(hdr);
    mips.forEach(free);
    hdr = target(w, h, true);
    mips = [];
    let a = w,
      b = h;
    for (let i = 0; i < opts.mips; i++) {
      a = Math.max(2, a >> 1);
      b = Math.max(2, b >> 1);
      mips.push(target(a, b));
    }
  }
  // the quality of a frame is how much of the targets it uses: no target is ever made again for it
  const fit = (q) => {
    vw = Math.max(16, Math.round(W * q));
    vh = Math.max(16, Math.round(HH * q));
    let a = vw,
      b = vh;
    for (const m of [hdr, ...mips]) {
      m.a = Math.min(m.w, a);
      m.b = Math.min(m.h, b);
      m.s[0] = m.a / m.w;
      m.s[1] = m.b / m.h;
      m.s[2] = (m.a - 0.5) / m.w;
      m.s[3] = (m.b - 0.5) / m.h;
      a = Math.max(2, a >> 1);
      b = Math.max(2, b >> 1);
    }
  };
  const bind = (unit, t, type = gl.TEXTURE_2D) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(type, t);
    },
    program = (n) => {
      const q = prog[n];
      gl.useProgram(q.p);
      if (q.stamp !== stamp) {
        q.stamp = stamp;
        if (q.s.uFrame) q.s.uFrame(fb);
      }
      return q.s;
    };
  const quad = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let query = null,
    waiting = false,
    gpu = 0;
  const pollTimer = () => {
    if (!waiting || !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
    waiting = false;
    if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
      const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gpu = gpu ? gpu + (ms - gpu) * 0.2 : ms;
    }
  };
  const nN = new Float32Array(48),
    nK = new Float32Array(48),
    pre = [0, 0, 0, 0, 0, 0];
  function frameData(s) {
    const c = s.cam;
    fb.set(c.vp, 0);
    const at = (i, a, w) => {
      const o = 16 + i * 4;
      fb[o] = a[0];
      fb[o + 1] = a[1];
      fb[o + 2] = a[2];
      fb[o + 3] = w;
    };
    const at4 = (i, a, b, d, e) => {
      const o = 16 + i * 4;
      fb[o] = a;
      fb[o + 1] = b;
      fb[o + 2] = d;
      fb[o + 3] = e;
    };
    at(0, c.eye, s.t);
    at4(1, s.mix, s.local, s.grow, s.planetY);
    at4(2, s.fog[0], s.fog[1], vw, vh);
    at(3, c.r, c.tan);
    at(4, c.u, vw / vh);
    at(5, c.f, s.haze);
    at(6, s.core, s.coreR);
    at(7, s.coreCol, s.corePow);
    at4(8, s.flash, s.season, s.head, s.phi);
    fb[52] = s.from + 0.5;
    fb[53] = s.to + 0.5;
    stamp++;
    for (let k = 0; k < K; k++) pre[k] = s.from === k ? (s.to === k ? 1 : 1 - s.mix) : s.to === k ? s.mix : 0;
  }
  const line = (u, i, a, rigid, reveal, pulse, live = i, pickSeed = -1, share = 1) => {
    if (a <= 0.003) return;
    u.uA(a);
    u.uKS(live);
    u.uRigid(rigid);
    u.uReveal(reveal);
    u.uPulse(pulse);
    u.uPick(pickSeed);
    gl.bindVertexArray(segs[i].v);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.floor(segs[i].n * share));
  };
  const surf = (kind, p, a, col, hot, g) => {
    if (a <= 0.003) return;
    const u = program("surf" + kind);
    u.uP(p);
    u.uA(a);
    u.uCol(col);
    u.uHot(hot);
    gl.bindVertexArray(g.v);
    gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_SHORT, 0);
  };
  const put = (i, v, w) => {
    const o = i * 4;
    dd[o] = v[0];
    dd[o + 1] = v[1];
    dd[o + 2] = v[2];
    dd[o + 3] = w;
  };
  function solid(s) {
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    if (pre[5] > 0.001) {
      const u = program(pre[5] > 0.999 ? "planet" : "planetD");
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.bindVertexArray(vSph);
      u.uScale(1);
      u.uA(pre[5]);
      gl.drawArrays(gl.TRIANGLES, 0, nSph);
      gl.disable(gl.CULL_FACE);
    }
    if (pre[4] > 0.02) {
      const whole = pre[4] > 0.999;
      let u = program(whole && s.grow > 1.1 ? "bark" : "barkD");
      u.uA(smooth(0.1, 0.8, pre[4]));
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 2);
      gl.bindVertexArray(vBark);
      gl.drawElements(gl.TRIANGLES, nBark, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      u = program(whole ? "leaf" : "leafD");
      u.uA(pre[4]);
      gl.bindVertexArray(vLeaf);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 12, Math.floor(nLeaf * s.share));
    }
    if (pre[0] > 0.02) {
      const a = smooth(0, 0.7, pre[0]);
      let u = program("boat");
      u.uA(a);
      gl.bindVertexArray(vBoat);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, nBoat, nFleet);
      if (full && s.phi > 0.3 && s.phi < 4.1) {
        u = program(pre[0] < 0.999 ? "whaleD" : "whale");
        u.uA(a);
        u.uPhi(s.phi);
        for (const p of [0, 1, 2, 3, 4]) {
          const m = p ? gFin : gBody;
          u.uPart(p);
          gl.bindVertexArray(m.v);
          gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
        }
      }
    }
    if (pre[0] > 0.02) {
      const u = program(pre[0] > 0.999 ? "water" : "waterD");
      u.uA(smooth(0, 0.7, pre[0]));
      u.uDrop(5 * (1 - pre[0]) * (1 - pre[0]));
      u.uSky(s.n1);
      u.uBoat(s.boatLight);
      gl.bindVertexArray(gWater.v);
      gl.drawElements(gl.TRIANGLES, gWater.n, gl.UNSIGNED_SHORT, 0);
    }
    gl.depthMask(false);
    gl.bindVertexArray(vQuad);
    program("back");
    bind(0, neb.t);
    quad();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    program("star");
    gl.bindVertexArray(vStar);
    gl.drawArrays(gl.POINTS, 0, G.stars.length / 4);
  }
  function light(s) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    let u;
    if (pre[5] > 0.001) {
      u = program("shell");
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.bindVertexArray(vSph);
      u.uScale(1.07);
      u.uA(pre[5]);
      gl.drawArrays(gl.TRIANGLES, 0, nSph);
      gl.disable(gl.CULL_FACE);
    }
    gl.bindVertexArray(vQuad);
    u = program("core");
    u.uDisc(s.disc);
    quad();
    if (pre[5] > 0.003) {
      u = program("aurora");
      gl.bindVertexArray(vCurt.v);
      for (const p of [0, 1.7, 3.1]) {
        u.uP(p);
        u.uA(pre[5] * s.aurora * (p ? 0.7 : 1));
        gl.drawElements(gl.TRIANGLES, vCurt.n, gl.UNSIGNED_SHORT, 0);
      }
    }
    if (pre[1] > 0.003) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      surf(1, 1.5, pre[1] * 1.1, s.cDust, s.cStorm, gSurf);
      surf(1, 0.72, pre[1] * 1.5, s.cMist, s.cStorm, gSurf);
      gl.disable(gl.CULL_FACE);
      surf(1, 1, pre[1] * 1.3, s.cStorm, s.cRose, gSurf);
    }
    if (full) {
      u = program("seg");
      line(u, 1, pre[1] * 0.8, -1, s.lit[1], 2, -1);
      line(u, 2, pre[2] * 0.13, -1, 9, 0);
      line(u, 2, pre[2] * 0.68, -1, s.lit[2], 2.2);
      line(u, 3, pre[3] * 0.95, -2, s.lit[3], 1.8);
      line(u, 4, pre[4], -1, s.grow - 0.03, 3.2);
      line(u, 5, pre[5] * 0.9, -1, s.lit[5], 1.5);
      line(u, 6, pre[1] * s.flash, -1, 9, 0, -1, s.bolt);
    }
    if (full) {
      bind(0, tLine, gl.TEXTURE_2D_ARRAY);
      gl.bindVertexArray(vStrip);
      program("streams");
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, NP * 2, NS);
    }
    bind(0, tForm, gl.TEXTURE_2D_ARRAY);
    gl.bindVertexArray(vPts);
    u = program("points");
    u.uSize(s.size);
    u.uFocus(s.focus);
    u.uBlur(s.blur);
    gl.drawArrays(gl.POINTS, 0, Math.floor(N * s.share));
    if (full) {
      bind(0, tPane, gl.TEXTURE_2D_ARRAY);
      gl.bindVertexArray(vQuad);
      program("panels");
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NG);
    }
    gl.bindVertexArray(vRing);
    for (const d of s.discs)
      if (d.a > 0.003) {
        u = program("disc" + d.kind);
        const inn = d.inner || 0;
        put(0, d.p, d.r);
        put(1, d.x, inn);
        put(2, d.y, d.a);
        put(3, d.col, d.spin || 0);
        put(4, d.hot || d.col, d.head ?? -1);
        dd[20] = d.kind === 0 ? inn * 0.985 : d.kind === 1 ? d.r * 0.72 : inn;
        dd[21] = d.r * 1.012;
        dd[22] = d.seed || 0;
        u.uD(dd);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 258);
      }
    if (full && s.nodes.length && s.nodeA > 0.003) {
      s.nodes.forEach((q, i) => {
        nN[i * 4] = q.p[0];
        nN[i * 4 + 1] = q.p[1];
        nN[i * 4 + 2] = q.p[2];
        nN[i * 4 + 3] = q.at;
        nK[i * 4] = q.col[0];
        nK[i * 4 + 1] = q.col[1];
        nK[i * 4 + 2] = q.col[2];
        nK[i * 4 + 3] = q.r;
      });
      u = program("node");
      u.uN(nN);
      u.uK(nK);
      u.uA(s.nodeA);
      gl.bindVertexArray(vQuad);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, s.nodes.length);
    }
  }
  function glow(s, unseen) {
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vQuad);
    let src = hdr,
      u = program("down");
    for (let i = 0; i < mips.length; i++) {
      const m = mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.f);
      gl.invalidateFramebuffer(gl.FRAMEBUFFER, COLOR);
      gl.viewport(0, 0, m.a, m.b);
      bind(0, src.t);
      u.uPx(1 / src.w, 1 / src.h);
      u.uS(src.s);
      u.uFirst(i ? 0 : 1);
      quad();
      src = m;
    }
    gl.enable(gl.BLEND);
    u = program("up");
    for (let i = mips.length - 1; i > 0; i--) {
      const a = mips[i],
        b = mips[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.f);
      gl.viewport(0, 0, b.a, b.b);
      bind(0, a.t);
      u.uPx(1 / a.w, 1 / a.h);
      u.uS(a.s);
      quad();
    }
    gl.disable(gl.BLEND);
    if (unseen) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, HH);
    bind(0, hdr.t);
    bind(1, mips[0].t);
    u = program("out");
    u.uS(hdr.s);
    u.uS2(mips[0].s);
    u.uDim(s.dim);
    u.uGlow(s.glow);
    u.uExpo(s.expo);
    u.uT(s.t);
    u.uGrade(s.grade);
    quad();
  }
  const DEPTH = [gl.DEPTH_ATTACHMENT],
    COLOR = [gl.COLOR_ATTACHMENT0];
  function draw(s, q = 1, unseen = false) {
    if (timer && !unseen) {
      pollTimer();
      if (!waiting) {
        query ||= gl.createQuery();
        gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      }
    }
    const timing = timer && !unseen && !waiting;
    fit(q);
    frameData(s);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    let u = program("neb");
    gl.bindFramebuffer(gl.FRAMEBUFFER, neb.f);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, COLOR);
    gl.viewport(0, 0, neb.w, neb.h);
    u.uN1(s.n1);
    u.uN2(s.n2);
    gl.bindVertexArray(vQuad);
    quad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.f);
    gl.viewport(0, 0, vw, vh);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    solid(s);
    light(s);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, DEPTH);
    glow(s, unseen);
    if (timing) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      waiting = true;
    }
  }
  /** resolves once the graphics card has really finished what was sent to it */
  async function settled(limit = 6000) {
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0),
      t = performance.now();
    gl.flush();
    while (performance.now() - t < limit) {
      const s = gl.clientWaitSync(f, 0, 0);
      if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) break;
      await new Promise((r) => setTimeout(r, 16));
    }
    gl.deleteSync(f);
  }
  return {
    gl,
    weak,
    more,
    get full() {
      return full;
    },
    format: FMT,
    size,
    draw,
    rest,
    settled,
    get gpu() {
      return gpu;
    },
    get lost() {
      return gl.isContextLost();
    },
    get w() {
      return W;
    },
  };
}
