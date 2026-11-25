import { Geo, clamp, lerp, smooth, smoother, v3, sub, cross, dot, norm, hex, K, PC, PR } from "./geo.js";
import { governor } from "./governor.js";
import { makeWorld } from "./renderer.js";
import { C, CH, T_OUT, T_SLIDE, UNITS } from "./timeline.js";

// ---------- the cameras: a path per chapter, as [eye, target, field of view] ----------
const CAM = [
  {
    k: [
      [[0, 12, 46], [0, 12.5, -40], 50],
      [[-1.8, 4.3, 21], [0, 5.8, -40], 43],
      [[-0.6, 3.2, 18.6], [0, 5.6, -40], 42],
      [[0.9, 2.8, 17.2], [0, 5.4, -40], 41],
    ],
    push: 0.12,
    pull: 0.06,
  },
  {
    k: [
      [[-25, 1.5, 27], [0, 4, 0], 52],
      [[-7.5, -3.6, 25.4], [0, 3.6, 0], 53],
      [[-4.6, -2.2, 25.2], [0, 3.4, 0], 53],
      [[-1.6, -0.4, 24.8], [0, 3.2, 0], 52],
    ],
    push: 0.35,
    pull: 0.28,
  },
  {
    k: [
      [[1, 18, 21], [0, 0, 0], 46],
      [[-3.2, 4.4, 17.4], [0, 0.4, 0], 43],
      [[-1.2, 3.5, 17], [0, 0.5, 0], 42],
      [[1, 2.4, 16.6], [0, 0.6, 0], 41],
    ],
    push: 0.3,
  },
  {
    k: [
      [[-19, 5.6, 25.5], [0, 0, -1], 46],
      [[-4.4, 3.4, 27], [0, 0, -0.6], 43],
      [[-1.6, 2.9, 26.6], [0, 0, -0.4], 43],
      [[0.6, 2.5, 26], [0, 0, -0.2], 43],
    ],
    push: 1.1,
  },
  {
    k: [
      [[-1.7, -6.35, 4.6], [0, -6.5, 0], 50],
      [[-5.4, -5, 8], [0, -3.6, 0], 50],
      [[-7.5, 1.2, 13.5], [0, 1.2, 0], 48],
      [[3, 3.6, 18.5], [0, 1.6, 0], 45],
      [[10.5, 1, 20.5], [0, 0.7, 0], 43],
    ],
    push: 0.22,
  },
  {
    k: [
      [[-6, 8, 18], [0, 3.2, 0], 46],
      [[-3, 5.4, 17], [0, 2.8, 0], 43],
      [[0, 4.2, 16], [0, 2.7, 0], 40],
    ],
    push: 0,
  },
];
const CORE = [
  { p: [0, 5.4, -58], r: 3.1, pow: 0.5, disc: 1, ring: 8.4, col: C.sea },
  { p: [0, 1.2, 0], r: 0.42, pow: 0.6, disc: 0, ring: 2.5, col: C.gold },
  { p: [0, 0, 0], r: 0.4, pow: 0.95, disc: 0, ring: 2.1, col: C.ice },
  { p: [0, 0, 1.6], r: 0.36, pow: 0.7, disc: 0, ring: 3.3, col: C.ice },
  { p: [0, -6.9, 0], r: 0.34, pow: 1.15, disc: 0, ring: 1.25, col: C.gold },
  { p: [0, 0, -46], r: 2.0, pow: 0.85, disc: 1, ring: 5.4, col: C.dawn },
];
const DIAL = [0, 0, 0, 0, 1, 0]; // how much of the dial the light wears
const LOOK = [
  { n1: "#0a2452", n2: "#0b5a74", haze: 1, fog: [16, 86], focus: 26, blur: 0.003, size: 0.03, glow: 0.42, expo: 1.0, grade: [0.95, 1, 1.06] },
  { n1: "#16246a", n2: "#4a1c46", haze: 0.15, fog: [24, 66], focus: 22, blur: 0.005, size: 0.028, glow: 0.45, expo: 1.0, grade: [1.02, 0.98, 1.05] },
  { n1: "#0c2c54", n2: "#124a6b", haze: 0.05, fog: [14, 46], focus: 14, blur: 0.006, size: 0.018, glow: 0.5, expo: 1.0, grade: [0.96, 1, 1.05] },
  { n1: "#0d2450", n2: "#3a1b3a", haze: 0.05, fog: [20, 60], focus: 17, blur: 0.005, size: 0.018, glow: 0.5, expo: 1.0, grade: [1, 1, 1] },
  { n1: "#0a3040", n2: "#123f2c", haze: 0.1, fog: [20, 58], focus: 18, blur: 0.004, size: 0.017, glow: 0.85, expo: 1.05, grade: [1.01, 1.01, 0.97] },
  { n1: "#0a1a46", n2: "#2c1820", haze: 0, fog: [30, 90], focus: 18, blur: 0.003, size: 0.018, glow: 0.4, expo: 1.0, grade: [1.04, 1, 0.96] },
].map((l) => ({ ...l, n1: hex(l.n1).map((x) => x * 0.5), n2: hex(l.n2).map((x) => x * 0.45) }));
const P = {
  a: ["#1b49b8", "#2a49d6", "#2f86d8", "#3a6fd8", "#1f8f6c", "#3a66c9"].map(hex),
  b: ["#63cfff", "#86a0ff", "#9be6ff", "#6fb4ff", "#6be7b2", "#ffb765"].map(hex),
  c: ["#e6f7ff", "#ffd9ee", "#ffffff", "#ffffff", "#ffe6ad", "#fff0d6"].map(hex),
  pow: [0.75, 0.62, 0.85, 0.6, 0.6, 1.3],
  sc: ["#2f8fe6", "#3f63ff", "#3fb2f2", "#3f7cff", "#2fb487", "#ff9a4d"].map(hex),
  sh: ["#bfeaff", "#ff9ac0", "#e2f8ff", "#cfe2ff", "#ffe2a0", "#fff0d8"].map(hex),
  sp: [0.34, 0.42, 0.18, 0.16, 0.75, 0.5],
  rest: [0.1, 0.12, 0.09, 0.05, 0.05, 0.07],
  gc: ["#8fd0ff", "#7f9cff", "#a6e4ff", "#7fb0ff", "#ffcf8f", "#ffd2a0"].map(hex),
  gp: [0.16, 0.42, 0.42, 0.42, 0.62, 0.3],
};
const MIST = hex("#b9b4ff"),
  HC = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)])),
  CORECOL = CORE.map((c) => hex(c.col));
const V = (a, b, f) => [a[0] + b[0] * f, a[1] + b[1] * f, a[2] + b[2] * f];
let TRUNK = [
    [0, -7, 0, 0.06],
    [0, 3, 0, 0.6],
  ],
  LAN = Array(5).fill([0, 0, 0]),
  CITY = [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  BOAT = [];
const cityAt = (c, t) => {
  const a = t * 0.006,
    [x, y, z] = c,
    r = PR * 1.01;
  return [PC[0] + (Math.cos(a) * x + Math.sin(a) * z) * r, PC[1] + y * r, PC[2] + (Math.cos(a) * z - Math.sin(a) * x) * r];
};
function place(G) {
  TRUNK = G.trunkLine;
  CITY = [
    [-0.31, 0.94, 0.1],
    [0.05, 0.96, -0.28],
    [0.45, 0.89, -0.13],
  ].map((q) => G.cities.reduce((a, b) => (dot(b, q) > dot(a, q) ? b : a))); // on this side of the horizon, where the window shows them
  // the five lanterns that carry a name stand as far apart on screen as they can
  const f = norm([10.5, 0, 20.5]),
    side = [f[2], 0, -f[0]],
    list = G.lanterns.filter((l) => dot(l.q, f) > 0).map((l) => ({ p: [l.q[0], l.q[1] - l.s * 0.8, l.q[2]], x: dot(l.q, side), y: l.q[1] }));
  const got = [list.reduce((a, b) => (a.x < b.x ? a : b))];
  while (got.length < 5)
    got.push(
      list.reduce((a, b) => {
        const d = (l) => Math.min(...got.map((g) => Math.hypot((g.x - l.x) * 0.8, (g.y - l.y) * 1.5)));
        return d(a) > d(b) ? a : b;
      }),
    );
  got.sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  LAN = [got[1], got[2], got[0], got[3], got[4]].map((g) => g.p);
}
// Things that happen in a scene: where, when (0–1 of the scene), and what they are called.
const EV = [
  [
    ["Voice memo", "Tuesday, 07:40", 0.4, () => [-11.5, 4.4, -17], C.sea, 0, false],
    ["Half a post", "Never sent", 0.48, () => [12.5, 5.2, -18], C.sea, 0, true],
    ["Old slide", "Page 14 of 60", 0.56, () => [-6.5, 2, -11], C.ink, 0, false],
    ["A good reply", "Lost in a thread", 0.65, () => [8, 1.9, -11], C.sea, 0, true],
  ],
  [
    ["Price list", "In the brochure", 0.34, () => [-4.6, 2.6, 2.4], C.storm, 0, true],
    ["Price list (final)", "On the site", 0.44, () => [5.4, 7.2, 1], C.storm, 0, false],
    ["Price list (final 2)", "In the code", 0.54, () => [3.1, -0.6, 4], C.rose, 0, false],
    ["Old page", "Still ranking", 0.64, () => [-4.4, 8.4, -2], C.rose, 0, true],
  ],
  [
    ["SEO", "Path, title, description", 0.36, () => [4.5, -3.6, 1.8], C.ice, 0, true],
    ["Sections", "The copy, in order", 0.46, () => [-4.5, -0.4, 1.8], C.ice, 0, false],
    ["JSON-LD", "Structured data", 0.58, () => [4.5, 2.2, 1.8], C.ice, 0, true],
    ["Git", "Every change", 0.72, () => [-4.5, 4.6, 1.8], C.gold, 0, false],
  ],
  [
    ["Schema", "Every field", 0.2, () => [-6.9, 6.9, 0], C.pass, 0, true],
    ["Voice", "Every line of copy", 0.3, () => [6.9, 6.9, 0], C.pass, 0, false],
    ["SEO", "Every built page", 0.4, () => [6.9, -6.9, 0], C.pass, 0, false],
    ["Held at the gate", "hero.webp: 412 KB, over 250 KB", 0.56, () => [-1.7, 3.3, 0.6], C.alert, 1],
  ],
  [
    ["Pages", "", 0.7, () => LAN[2], C.gold],
    ["Posts", "", 0.75, () => LAN[0], C.gold],
    ["Feed", "", 0.8, () => LAN[1], C.gold],
    ["Sitemap", "", 0.85, () => LAN[3], C.gold],
    ["Redirects", "", 0.9, () => LAN[4], C.gold],
  ],
  [
    ["Lisbon", "Ready", 0.34, (t) => cityAt(CITY[0], t), C.dawn, 0, false],
    ["Nairobi", "Ready", 0.46, (t) => cityAt(CITY[1], t), C.dawn, 0, false],
    ["Osaka", "Ready", 0.58, (t) => cityAt(CITY[2], t), C.dawn, 0, false],
  ],
];
const EVCOL = EV.map((l) => l.map((e) => hex(e[4])));
const at = (u) => {
  let k = CH.findIndex((c) => u < c.end);
  if (k < 0) k = CH.length - 1;
  return k;
};
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const spline = (a, b, c, d, t) => {
  const f = (p, q, r, s) => 0.5 * (2 * q + (r - p) * t + (2 * p - 5 * q + 4 * r - s) * t * t + (3 * q - p - 3 * r + s) * t * t * t);
  return Array.isArray(a) ? a.map((_, i) => f(a[i], b[i], c[i], d[i])) : f(a, b, c, d);
};
const rail = (i, l, push) => {
  const r = CAM[i],
    n = r.k.length - 1,
    x = clamp(lerp(l, inOut(l), 0.45)) * n,
    j = Math.min(n - 1, Math.floor(x)),
    g = (m) => r.k[clamp(m, 0, n)],
    s = (m) => spline(g(j - 1)[m], g(j)[m], g(j + 1)[m], g(j + 2)[m], x - j),
    pos = s(0),
    tar = s(1);
  return [v3(pos, tar, push * r.push), tar, s(2)];
};
const perspective = (fov, asp) => {
  const f = 1 / Math.tan((fov * Math.PI) / 360),
    n = 0.25,
    r = 400;
  return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (r + n) / (n - r), -1, 0, 0, (2 * r * n) / (n - r), 0];
};
const mul = (a, b) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
function camera(eye, target, fov, asp) {
  const f = norm(sub(target, eye)),
    r = norm(cross(f, [0, 1, 0])),
    u = cross(r, f);
  const view = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1];
  return { eye, f, r, u, tan: Math.tan((fov * Math.PI) / 360), vp: mul(perspective(fov, asp), view) };
}
const project = (m, p, w, h) => {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    z = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [((x / z) * 0.5 + 0.5) * w, (0.5 - (y / z) * 0.5) * h, z];
};
const wave = (x, z, t) =>
  Math.sin(x * 0.21 + t * 0.55) * 0.55 +
  Math.sin(z * 0.27 - t * 0.7 + x * 0.09) * 0.5 +
  Math.sin((x + z) * 0.55 + t * 1.1) * 0.17 +
  Math.sin(x * 1.1 - z * 0.8 + t * 1.7) * 0.07;
const bend = (h, t) => {
  const k = h * (1.4 - 0.95 * h);
  return [
    (Math.sin(h * 3.4 + t * 0.26) * 3.1 + Math.sin(h * 6.1 - t * 0.21) * 0.5) * k + Math.sin(t * 0.17) * 1.1 * (1 - h),
    Math.cos(h * 2.9 + t * 0.21) * 2.2 * k + Math.cos(t * 0.13) * 0.8 * (1 - h),
  ];
};
const FLAT = { x: [1, 0, 0], y: [0, 0, 1] },
  WALL = { x: [1, 0, 0], y: [0, 1, 0] },
  GYRO = (a, b) => ({ x: [Math.cos(a), Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b)], y: [0, Math.cos(b), -Math.sin(b)] });
const growth = (l) => lerp(0.0, 0.5, smooth(0.05, 0.52, l)) + 0.64 * smooth(0.46, 0.84, l),
  onTrunk = (g) => {
    let i = 0;
    while (i < TRUNK.length - 2 && TRUNK[i + 1][3] < g) i++;
    return v3(TRUNK[i], TRUNK[i + 1], clamp((g - TRUNK[i][3]) / (TRUNK[i + 1][3] - TRUNK[i][3] || 1)));
  };

/** Everything the renderer needs at story position u (screens) and time t (seconds). */
function stateAt(u, t, asp, mouse) {
  const k = at(u),
    c = CH[k],
    n = Math.min(k + 1, K - 1),
    local = clamp((u - c.s0) / c.scene);
  const mix = c.final ? 0 : smoother((u - (c.t0 - 0.25)) / (c.end - 0.12 - (c.t0 - 0.25)));
  const inSlide = smooth(c.s1, c.t0 + 0.1, u) * (c.final ? 1 : 1 - smooth(c.t1 - 0.1, c.end, u));
  const dim = lerp(1, c.final ? 0.5 : 0.2, inSlide);
  let [eye, tar, fov] = rail(k, local, smooth(c.s1, c.end, u));
  if (mix > 0) {
    const [e2, t2, f2] = rail(n, 0, 0),
      m = smoother(smooth(c.t0 + 0.1, c.end, u));
    eye = v3(eye, e2, m);
    tar = v3(tar, t2, m);
    fov = lerp(fov, f2, m);
  }
  const back = asp < 1.6 ? clamp(1.6 / asp, 1, 2.6) : 1;
  const pull = lerp(CAM[k].pull ?? 0.5, CAM[n].pull ?? 0.5, smooth(c.t0, c.end, u)) * (k === 4 ? 0.8 * smooth(0.25, 0.7, local) : 1);
  eye = V(tar, sub(eye, tar), 1 + (back - 1) * pull);
  fov *= 1 + (back - 1) * 0.14;
  const dist = Math.hypot(...sub(eye, tar));
  eye = [eye[0] + mouse[0] * dist * 0.02 + Math.sin(t * 0.21) * dist * 0.004, eye[1] - mouse[1] * dist * 0.013 + Math.sin(t * 0.17 + 2) * dist * 0.003, eye[2]];
  if (k === 0 || (k === 5 && mix > 0)) eye[1] = Math.max(eye[1], 1.9);
  if (k === 4) eye[1] = Math.max(eye[1], -6.5);
  const cam = camera(eye, tar, fov, asp);
  const A = LOOK[k],
    B = LOOK[n],
    L = (key) => (Array.isArray(A[key]) ? A[key].map((x, i) => lerp(x, B[key][i], mix)) : lerp(A[key], B[key], mix));
  const rise = c.final ? smooth(c.s1 - 0.1, c.t1 - 0.2, u) : 0;
  const coreAt = (i, l) => {
    if (i === 2) return [0, lerp(-11, 9.5, l), 0];
    if (i === 5) return [2.2 * (1 - rise), lerp(-10.5, 3.2, smooth(0, 1, l)) + rise * 8.5, -46];
    if (i === 1) {
      const h = 0.36,
        b = bend(h, t);
      return [b[0], -7.35 + h * 21, b[1]];
    }
    if (i === 4) {
      const g = growth(l);
      return g < 0.06 ? v3([0, -6.95, 0], TRUNK[0], g / 0.06) : v3(onTrunk(g), [0.2, 3.3, 0.2], smooth(TRUNK.at(-1)[3] - 0.05, 0.85, g));
    }
    return CORE[i].p;
  };
  const ca = CORE[k],
    cb = CORE[n];
  const core = v3(coreAt(k, local), coreAt(n, 0), mix),
    coreR = lerp(ca.r, cb.r, mix),
    ring = lerp(ca.ring, cb.ring, mix),
    disc = lerp(ca.disc, cb.disc, mix),
    coreCol = v3(CORECOL[k], CORECOL[n], mix);
  const pr = (i) => (i === k ? 1 - mix : i === n && n !== k ? mix : 0);
  const planet = Math.max(pr(5), 0),
    head = k === 5 ? smooth(0.05, 0.9, local) : k === 4 ? growth(local) : smooth(0.04, 0.8, local);
  const beat = Math.floor(t / 2.9),
    bx = t - beat * 2.9,
    r01 = (x) => {
      const s = Math.sin(x * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
  const flash = pr(1) > 0 && r01(beat + 3) > 0.3 ? Math.exp(-bx * 6.5) + 0.55 * Math.exp(-Math.pow((bx - 0.24) * 16, 2)) : 0;
  const phi = k === 0 ? lerp(-0.5, 4.6, smooth(0.1, 1.02, local) * 0.35 + clamp((local - 0.12) / 0.88) * 0.65) : 9;
  const discs = [],
    face = { x: cam.r, y: cam.u };
  const rc = coreCol.map((x) => x * 0.9),
    big = disc > 0.5,
    quiet = k === 4 ? 1 - 0.7 * smooth(0.05, 0.2, local) : 1;
  discs.push(
    { p: core, ...face, r: ring, inner: ring * 0.74, kind: 0, spin: t * 0.01, a: (big ? 0.3 : 0.34) * quiet * lerp(DIAL[k], DIAL[n], mix), col: rc },
    {
      p: core,
      ...(big ? face : GYRO(t * 0.22, 0.9)),
      r: ring * (big ? 1.5 : 0.72),
      inner: ring * (big ? 1.36 : 0.6),
      kind: 0,
      spin: -t * 0.014,
      a: 0.2 * quiet * lerp(DIAL[k], DIAL[n], mix),
      col: rc,
    },
  );
  if (pr(0)) {
    for (const [x, z] of BOAT) discs.push({ p: [x, wave(x, z, t) + 0.14, z], ...FLAT, r: 2.6, inner: 0.5, kind: 2, seed: x, a: 0.16 * pr(0), col: HC.sea });
    discs.push({ p: [0, 1.5, -16], ...FLAT, r: 46, inner: 8, kind: 6, a: 0.13 * pr(0), col: HC.sea });
    for (const [x, z, q] of [
      [-12.2, -13.4, 0.44],
      [12.2, -16.2, 2.7],
    ]) {
      const on = smooth(q - 0.1, q + 0.2, phi) * (1 - smooth(q + 1, q + 1.7, phi));
      if (on > 0)
        discs.push(
          { p: [x, 0.9, z], ...FLAT, r: 7 + on * 2, inner: 0.4, kind: 2, seed: q, a: 0.7 * on * pr(0), col: HC.ice },
          { p: [x, 1.1, z], ...FLAT, r: 6, inner: 0.2, kind: 6, a: 1.6 * on * pr(0), col: HC.ice },
        );
    }
  }
  if (pr(1)) {
    discs.push(
      { p: [bend(1, t)[0], 13.5, bend(1, t)[1]], ...FLAT, r: 42, inner: 2.2, kind: 5, a: 0.6 * pr(1), col: HC.storm, hot: HC.ink },
      { p: [bend(0, t)[0], -6.9, bend(0, t)[1]], ...FLAT, r: 22, inner: 0.5, kind: 5, a: 0.6 * pr(1), col: v3(HC.storm, HC.gold, 0.22), hot: HC.ink },
      { p: [bend(0, t)[0], -6.4, bend(0, t)[1]], ...FLAT, r: 12, inner: 0.4, kind: 6, a: 0.8 * pr(1), col: v3(MIST, HC.gold, 0.4) },
      { p: [0, -7.4, 0], ...FLAT, r: 34, inner: 6, kind: 6, a: 0.35 * pr(1), col: HC.storm },
    );
  }
  if (pr(2)) discs.push({ p: core, ...FLAT, r: 5.2, inner: 0.4, kind: 2, seed: 0.2, a: 0.16 * pr(2), col: HC.ice });
  if (pr(3)) {
    const held = k === 3 ? smooth(0.54, 0.6, local) : 0;
    discs.push({ p: [0, 0, -0.4], ...WALL, r: 10.4, inner: 4.4, kind: 2, seed: 0.4, a: 0.2 * pr(3), col: HC.signal });
    if (held > 0)
      discs.push({
        p: [-3, 1.7, 0.5],
        ...face,
        r: 2.6,
        inner: 0.9,
        kind: 2,
        seed: 0.3,
        a: 0.2 * held * pr(3),
        col: HC.alert,
        head: local < 0.95 ? smooth(0.56, 0.85, local) : -1,
      });
  }
  if (pr(4)) {
    const g = k === 4 ? growth(local) : 0;
    discs.push(
      { p: [0, -7.16, 0], ...FLAT, r: 26, inner: 0.7, kind: 4, a: 0.3 * pr(4), col: HC.leaf, hot: HC.gold, head: k === 4 && g < 0.99 ? clamp(g) : -1 },
      { p: [0, -7.12, 0], ...FLAT, r: 5, inner: 4.1, kind: 0, spin: t * 0.01, a: 0.22 * pr(4) * (k === 4 ? 1 - smooth(0.6, 1, local) : 1), col: HC.gold },
      { p: [0, -6.5, 0], ...FLAT, r: 26, inner: 2, kind: 6, a: 0.1 * pr(4), col: HC.leaf },
    );
  }
  const ev = EV[k],
    nodeA = (c.final ? 1 - inSlide : 1 - smooth(c.s1 - (k === 3 ? 0.12 : 0), k === 3 ? c.s1 + 0.14 : c.t0 + 0.1, u)) * smooth(c.s0 - 0.3, c.s0 + 0.1, u);
  const nodes = ev.map((e, i) => ({
    p: e[3](t),
    at: e[2],
    col: EVCOL[k][i],
    r: (e[5] ? 0.8 : 0.95) * (k === 5 ? 0.8 : 1) * (k === 0 ? 1.1 : 1) * (k === 4 ? 1.15 : 1),
  }));
  const past = (i) => (i === k ? local * 1.15 : i < k ? 1.2 : 0);
  const lit = [
    1,
    past(1),
    k === 2 ? (core[1] + 14.4) / 28 + 1.2 * smooth(c.s1, c.t0, u) : past(2),
    k === 3 ? Math.max(past(3), 0.04 + 1.1 * smooth(-0.05, 0.26, local)) : k === 2 ? 1.2 * mix : past(3),
    1,
    past(5) * 1.2,
  ];
  return {
    k,
    n,
    local,
    u,
    from: k,
    to: n,
    mix: n === k ? 0 : mix,
    grow: k === 4 ? growth(local) : n === 4 && k === 3 ? 0 : 1.14,
    season: k === 4 ? smooth(0.8, 1, local) : k > 4 ? 1 : 0,
    flash,
    bolt: Math.floor(r01(beat + 9) * 4),
    t,
    cam,
    dim,
    inSlide,
    core,
    coreR: coreR * (k === 4 ? 1 + 0.5 * smooth(0.3, 0.9, local) : 1),
    corePow: lerp(ca.pow, cb.pow, mix) * (1 - (disc > 0.5 && !c.final ? 0.6 : 0) * inSlide),
    disc,
    coreCol,
    planet,
    planetY: lerp(-26, 0, smoother(planet)),
    n1: L("n1"),
    n2: L("n2"),
    haze: L("haze"),
    fog: L("fog").map((x) => x * (1 + (back - 1) * pull * 0.9)),
    focus: L("focus"),
    blur: L("blur"),
    size: L("size"),
    glow: L("glow"),
    expo: L("expo"),
    grade: L("grade"),
    head: mix > 0 ? Math.max(head, 1.2 * mix) : head,
    discs,
    nodes,
    nodeA,
    lit,
    share: 1,
    phi,
    boatLight: BOAT.flatMap(([x, z], i) => [x, wave(x, z, t) + 0.75, z, 0.85 + 0.15 * Math.sin(t * (5 + i * 0.4) + i * 9)]),
    aurora: k === 5 ? 1 - 0.55 * smooth(0.55, 1, local) : 1,
    cStorm: HC.storm,
    cDust: HC.deep,
    cMist: MIST,
    cRose: HC.rose,
    cIce: HC.ice,
    cInk: HC.ink,
    cSignal: HC.signal,
  };
}

// ---------- geometry off the main thread; on it, in slices, only where workers are not allowed ----------
function geometry(small, count) {
  let one, two, no;
  const first = new Promise((y, n) => {
      one = y;
      no = n;
    }),
    rest = new Promise((y, n) => {
      two = y;
      const f = no;
      no = (e) => {
        f(e);
        n(e);
      };
    });
  rest.catch(() => {});
  let used = false;
  const here = async () => {
    if (used) return;
    used = true;
    try {
      const it = Geo().run(small, count);
      let since = performance.now(),
        r;
      do {
        r = it.next();
        if (r.value && !r.done) one(r.value);
        if (performance.now() - since > 6) {
          await new Promise((f) => setTimeout(f));
          since = performance.now();
        }
      } while (!r.done);
      two(r.value);
    } catch (e) {
      no(e);
    }
  };
  try {
    const src = `const G=(${Geo})();onmessage=(e)=>{const it=G.run(e.data[0],e.data[1]),own=(v)=>{const b=[],f=(a)=>{for(const x of Object.values(a))if(ArrayBuffer.isView(x))b.push(x.buffer);else if(x&&typeof x=="object"&&!b.includes(x))f(x);};f(v);return [...new Set(b)]};let r;do{r=it.next();if(r.value)postMessage(r.value,own(r.value))}while(!r.done)}`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    w.onmessage = (e) => {
      if (!used) {
        used = true;
        return one(e.data);
      }
      two(e.data);
      w.terminate();
    };
    w.onerror = (e) => {
      e.preventDefault();
      if (used) no(e);
      else here();
    };
    w.postMessage([small, count]);
  } catch {
    here();
  }
  return { first, rest };
}

// ---------- the page ----------
const $ = (q, e = document) => e.querySelector(q),
  $$ = (q, e = document) => [...e.querySelectorAll(q)];
async function start() {
  const test = window.__storyTest; // set by `agentic-cms story`: draw on any renderer, and leave the frames to render() unless it asks for the loop
  const root = document.documentElement,
    home = $("#home"),
    stage = $("#stage"),
    track = $("#track"),
    canvas = $("#gl");
  const route = () => {
    const b = location.hash === "#blog";
    $("#blog").hidden = !b;
    home.hidden = b;
    if (b) scrollTo(0, 0);
    document.body.classList.toggle("is-blog", b);
  };
  addEventListener("hashchange", route);
  route();
  const copy = $("#copy");
  copy.addEventListener("click", () => {
    const code = $("#cmd code"),
      done = (word) => {
        copy.textContent = word;
        setTimeout(() => (copy.textContent = "Copy"), 1800);
      },
      pick = () => {
        const r = document.createRange();
        r.selectNodeContents(code);
        const q = getSelection();
        q.removeAllRanges();
        q.addRange(r);
        done("Selected");
      };
    if (navigator.clipboard) navigator.clipboard.writeText(code.textContent).then(() => done("Copied"), pick);
    else pick();
  });
  const idle = [];
  let beat = 0,
    drawing = false;
  const listen = (ms) => {
    if (drawing) return;
    if (beat) idle.push(ms - beat);
    beat = ms;
    requestAnimationFrame(listen);
  };
  requestAnimationFrame(listen);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches,
    coarse = matchMedia("(pointer: coarse)").matches,
    phone = innerWidth < 760,
    tablet = coarse && !phone;
  if (!still) root.dataset.mode = "story";
  // the sea first: its data, its programs, its picture. Everything else is made behind it.
  let world = null,
    G = null,
    R = null;
  const geo = geometry(phone, phone ? 11000 : tablet ? 18000 : 26000),
    make = () => makeWorld(canvas, G, { mips: phone ? 5 : 6, soft: !!test, palette: P }),
    finish = async () => {
      if (!R) {
        R = await geo.rest;
        place(R);
      }
      await world.more(R);
    };
  try {
    G = await geo.first;
    BOAT = G.boats;
    world = await make();
  } catch (e) {
    console.error(e);
  }
  const plain = () => {
    root.dataset.mode = "plain";
    track.style.height = "";
  };
  if (!world) return plain();
  // the still version: the same scenes, one picture each, in a normal document
  const stills = () => {
    const u = root.dataset.mode === "story" ? clamp((scrollY - track.offsetTop) / innerHeight, 0, UNITS) : -1;
    root.dataset.mode = "stills";
    if (u > 0.3) $(`#${CH[at(u)].id}`).scrollIntoView();
    const draw = (i) => {
      const pic = $(`[data-still="${i}"]`);
      if (!pic || pic.dataset.done) return;
      pic.dataset.done = 1;
      const w = (pic.width = 1280),
        h = (pic.height = 720);
      world.size(w, h);
      world.draw(stateAt(CH[i].s0 + CH[i].scene * 0.86, 20, w / h, [0, 0]));
      pic.getContext("2d").drawImage(canvas, 0, 0);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && draw(+e.target.dataset.still)), { rootMargin: "60%" });
    $$("[data-still]").forEach((e) => io.observe(e));
  };
  if (still || world.weak) {
    try {
      await finish();
    } catch (e) {
      console.error(e);
      return plain();
    }
    return stills();
  }
  let gone = false,
    over = false,
    w = stage.clientWidth,
    h = stage.clientHeight,
    top = 0;
  const room = () => {
    if (!stage.clientWidth || !stage.clientHeight) return;
    w = stage.clientWidth;
    h = stage.clientHeight;
    top = track.offsetTop;
    const budget = phone ? 9e5 : tablet ? 1.3e6 : 1.9e6,
      dpr = Math.min(devicePixelRatio || 1, phone ? 1.6 : 1.75, Math.sqrt(budget / (w * h)));
    world.size(Math.round(w * dpr), Math.round(h * dpr));
  };
  room();
  new ResizeObserver(room).observe(stage);
  // every program is used once, small and unseen, before the reader reaches it: the chapter on screen now, the others while the reader is on it
  const warm = async (k) => {
    for (const u of [CH[k].s0 + CH[k].scene * 0.8, CH[k].t1 + 0.1]) {
      world.draw(stateAt(Math.min(u, UNITS), 20, w / h, [0, 0]), 0.06, true);
      await world.settled(1500);
    }
  };
  const u0 = clamp((scrollY - top) / h, 0, UNITS),
    here = at(u0),
    alone = here === 0 && u0 < CH[0].t0 - 0.3;
  let warmed;
  const others = async () => {
    for (const k of [...Array(K).keys()].filter((k) => k !== here).sort((a, b) => Math.abs(a - here) - Math.abs(b - here))) {
      await new Promise((r) => setTimeout(r, test && !test.loop ? 0 : 160));
      await warm(k);
    }
  };
  const failed = (e) => {
    console.error(e);
    over = true;
    canvas.classList.remove("lit");
    plain();
  };
  if (!alone) {
    try {
      await finish();
    } catch (e) {
      return failed(e);
    }
    await warm(here);
  }
  world.draw(stateAt(u0, 8, w / h, [0, 0]), 1);
  await world.settled(1200);
  // a phone takes the graphics memory of a page it put away: build the scene again when it gives it back
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    gone = true;
    canvas.classList.remove("lit");
  });
  canvas.addEventListener("webglcontextrestored", async () => {
    try {
      world = await make();
      room();
      await world.more(R || (R = await geo.rest));
      gone = false;
      canvas.classList.add("lit");
    } catch {
      over = true;
      root.dataset.mode = "plain";
    }
  });
  canvas.classList.add("lit");
  performance.mark("story:first-picture");
  warmed = alone ? finish().then(others).catch(failed) : others();
  const slides = $$(".slide").map((el) => ({ el, words: $$(".w", el), rest: $$(".late", el) })),
    caps = $$(".cap"),
    hero = $("#hero"),
    dots = $$("#rail a"),
    now = $("#now"),
    ringEl = $("#ring"),
    hint = $("#hint"),
    labels = EV.map((list) =>
      list.map((e) => {
        const el = document.createElement("div");
        el.className = "lab" + (e[5] ? " held" : "");
        el.style.setProperty("--c", e[4]);
        el.innerHTML = `<i></i><div data-story-card><b>${e[0]}</b>${e[1] ? `<span>${e[1]}</span>` : ""}</div>`;
        $("#labels").append(el);
        return el;
      }),
    );
  dots.forEach((d, i) =>
    d.addEventListener("click", (e) => {
      e.preventDefault();
      stop();
      scrollTo({ top: top + (CH[i].s0 + (i ? 0.25 : 0)) * h });
    }),
  );
  let pos = scrollY / h,
    mouse = [0, 0],
    mt = [0, 0],
    last = performance.now(),
    playing = null,
    t0 = performance.now(),
    chapter = -1,
    shown = true;
  drawing = true;
  idle.sort((x, y) => x - y);
  const gov = governor(
    {
      get gpu() {
        return world.gpu;
      },
      get w() {
        return world.w;
      },
    },
    phone || tablet,
    idle.length > 11 ? idle[Math.floor(idle.length * 0.3)] : 0,
  );
  new IntersectionObserver((es) => {
    shown = es[0].isIntersecting;
  }).observe(stage);
  if (!coarse)
    addEventListener(
      "pointermove",
      (e) => {
        mt = [(e.clientX / w) * 2 - 1, (e.clientY / h) * 2 - 1];
      },
      { passive: true },
    );
  const play = $("#play"),
    stop = () => {
      if (playing) {
        playing = null;
        play.setAttribute("aria-pressed", "false");
        $("#playtext").textContent = "Play the story";
      }
    };
  play.addEventListener("click", () => {
    if (playing) return stop();
    if (scrollY > (UNITS - 0.2) * h) scrollTo(0, 0);
    playing = { y: scrollY, v: 0 };
    play.setAttribute("aria-pressed", "true");
    $("#playtext").textContent = "Pause";
  });
  for (const ev of ["wheel", "touchstart", "keydown"])
    addEventListener(
      ev,
      (e) => {
        if (ev === "wheel" || !(e.target instanceof Element && e.target.closest("#play,#speed"))) stop();
      },
      { passive: true },
    );
  const speed = $("#speed"),
    read = $("#read");
  speed.addEventListener("click", () => {
    const on = read.hidden;
    read.hidden = !on;
    speed.setAttribute("aria-pressed", on);
  });
  setInterval(() => {
    if (read.hidden) return;
    const s = gov.stats();
    read.textContent = `${s.fps.toFixed(0)} fps of ${Math.round(s.hz)}${s.half ? " (half rate)" : ""}\nlate frames ${s.late} of ${s.n}\nworst ${s.worst.toFixed(0)} ms\ngraphics ${s.gpu ? s.gpu.toFixed(1) + " ms" : "not measured"}\npicture ${Math.round(s.q * 100)}% of ${s.w} px${s.detail < 1 ? ", fewer details" : ""}${s.hz < 31 && self !== top ? "\nheld at 30 here: tap the page" : s.hz < 31 ? "\nheld at 30 by the browser" : ""}`;
  }, 500);
  // words move by transform and opacity only, and are written only when they change
  const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
  const set = (el, o, y = 0) => {
    const a = Math.round(o * 100),
      b = Math.round(y * 2);
    if (el._a !== a) {
      if (!a !== !el._a || el._a === undefined) el.style.visibility = a ? "" : "hidden";
      el._a = a;
      el.style.opacity = a / 100;
      if (!a) return;
    }
    if (a && el._b !== b) {
      el._b = b;
      el.style.transform = `translate3d(0,${b / 2}px,0)`;
    }
  };
  function words(S) {
    const u = S.u,
      k = S.k;
    set(hero, 1 - smooth(0.12, 0.5, u), -smooth(0.1, 0.55, u) * 60);
    if (u > 0.3 !== hero._off) {
      hero._off = u > 0.3;
      hero.style.pointerEvents = hero._off ? "none" : "";
    }
    slides.forEach((s, i) => {
      const d = CH[i],
        a = (u - (d.s1 + 0.18)) / ((d.final ? 0.5 : T_OUT) + T_SLIDE * 0.45),
        off = d.final ? 0 : smooth(d.t1 - 0.05, d.t1 + 0.34, u),
        on = a > 0 && off < 1;
      if (s.on !== on) {
        s.on = on;
        s.el.classList.toggle("on", on);
      }
      if (!on) return;
      s.words.forEach((w2, j) => {
        const e = outExpo((a - j * 0.055) / 0.5);
        set(w2, e, (1 - e) * 30);
      });
      s.rest.forEach((r, j) => {
        const e = outExpo((a - 0.42 - j * 0.1) / 0.5);
        set(r, e, (1 - e) * 18);
      });
      set(s.el.firstElementChild, 1 - off, -off * 40);
    });
    caps.forEach((el, i) => {
      const d = CH[i];
      if (Math.abs(i - k) > 1 && el._a === 0) return;
      const a = i === 0 ? smooth(0.55, 0.85, u) : smooth(d.s0 + 0.02, d.s0 + 0.3, u),
        b = 1 - smooth(d.s1 - 0.05, d.s1 + 0.22, u);
      set(el, a * b, (1 - a) * 16 - (1 - b) * 10);
    });
    if (chapter !== k) {
      if (chapter >= 0)
        labels[chapter].forEach((el) => {
          el._a = 0;
          el._shown = false;
          el.classList.remove("on");
        });
      chapter = k;
      dots.forEach((d, i) => d.classList.toggle("on", i === k));
      now.innerHTML = `<b>${String(k + 1).padStart(2, "0")}</b> / ${String(CH.length).padStart(2, "0")}<br>${CH[k].name}`;
      $("#side").style.setProperty("--accent", CH[k].accent);
    }
    EV[k].forEach((e, j) => {
      const el = labels[k][j],
        nx = EV[k][j + 1];
      const o = smooth(e[2], e[2] + 0.07, S.local) * S.nodeA * (w < 760 && nx ? 1 - smooth(nx[2] - 0.03, nx[2] + 0.02, S.local) : 1);
      if (o < 0.004) {
        el._shown = false;
        if (el._a) {
          el._a = 0;
          el.classList.remove("on");
        }
        return;
      }
      const p = project(S.cam.vp, e[3](S.t), w, h),
        small = w < 760;
      if (!el._shown) el._w = el.lastElementChild.offsetWidth + (small ? 46 : 70);
      let flip = el._shown ? el._f : (e[6] ?? ((small ? p[0] > w * 0.55 : p[0] > w * 0.66) || (!!e[5] && !small)));
      if (el._shown);
      else if (flip && p[0] < el._w + 8 && w - p[0] > el._w) flip = false;
      else if (!flip && w - p[0] < el._w + (small ? 8 : 150) && p[0] > el._w) flip = true;
      el._shown = true;
      const left = flip ? p[0] - el._w : p[0],
        capR = Math.min(432, w * 0.78) + 48,
        clear = small ? 1 : 1 - smooth(0.72, 0.79, p[1] / h) * smooth(capR + 24, capR - 24, left),
        a = p[2] > 1 ? Math.round(o * clear * 100) : 0;
      if (el._a !== a) {
        if (!el._a && a) el.classList.add("on");
        el._a = a;
        el.style.opacity = a / 100;
      }
      if (el._f !== flip) {
        el._f = flip;
        el.classList.toggle("flip", flip);
      }
      el.style.transform = `translate3d(${clamp(p[0], 16, w - 16).toFixed(1)}px,${p[1].toFixed(1)}px,0)`;
    });
    const r = Math.round(100 - clamp(u / UNITS) * 100);
    if (ringEl._v !== r) {
      ringEl._v = r;
      ringEl.style.strokeDashoffset = r;
    }
    set(hint, 1 - smooth(0.05, 0.3, u));
  }
  function frame(ms) {
    if (over) return;
    requestAnimationFrame(frame);
    if (home.hidden || document.hidden || !shown || gone || world.lost) {
      last = ms;
      return;
    }
    const y = scrollY;
    if (!gov.tick()) return;
    const raw = ms - last,
      dt = Math.min(0.05, raw / 1000 || 0.016);
    last = ms;
    if (raw < 2000) gov.frame(Math.min(raw, 400), ms);
    if (gov.hopeless && !test) {
      over = true;
      stop();
      return stills();
    }
    if (playing) {
      playing.v = Math.min(1, playing.v + dt);
      playing.y += dt * h * 0.46 * playing.v;
      scrollTo(0, playing.y);
      if (playing.y > UNITS * h) stop();
    }
    const goal = clamp(((playing ? playing.y : y) - top) / h, 0, UNITS);
    pos += (goal - pos) * (1 - Math.exp(-dt * 6.5));
    if (Math.abs(goal - pos) > 6) pos = goal - Math.sign(goal - pos) * 1.2;
    const f = 1 - Math.exp(-dt * 2.5);
    mouse[0] += (mt[0] - mouse[0]) * f;
    mouse[1] += (mt[1] - mouse[1]) * f;
    render(pos, (ms - t0) / 1000 + 8, gov.q);
  }
  function render(u, t, qual) {
    const S = stateAt(u, t, w / h, mouse);
    S.share = gov.detail;
    if (world.full) world.draw(S, qual);
    else {
      const F = stateAt(Math.min(u, CH[0].t0 - 0.3), t, w / h, mouse);
      F.share = gov.detail;
      world.draw(F, qual);
    }
    words(S);
  }
  stage.classList.add("ready");
  // what `agentic-cms story` draws with: any frame, words and cards included, and when everything is ready
  if (test) window.__story = { length: UNITS, scenes: CH.map((c) => ({ id: c.id, from: c.s0, to: c.s1, end: c.end })), ready: warmed, render: (u, t, q = 1) => render(u, t, q) };
  if (!test || test.loop) requestAnimationFrame(frame);
}
requestAnimationFrame(() => setTimeout(start));
