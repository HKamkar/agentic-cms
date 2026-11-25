export function Geo() {
  // ---------- small maths ----------
  const TAU = Math.PI * 2,
    clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)),
    lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
      const t = clamp((x - a) / (b - a));
      return t * t * (3 - 2 * t);
    },
    smoother = (t) => {
      t = clamp(t);
      return t * t * t * (t * (t * 6 - 15) + 10);
    };
  const v3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    norm = (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    add = (a, b, f = 1) => [a[0] + b[0] * f, a[1] + b[1] * f, a[2] + b[2] * f];
  const hex = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
  let seed = 20261124;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mixed = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const NS = 30,
    NP = 72,
    NG = 120,
    HELD = 72;
  const K = 6,
    PC = [0, -10.5, -2],
    PR = 12,
    GROUND = -7; // six chapters; the planet's centre and radius; the tree's ground

  const FUN = (h) => 0.9 + Math.pow(h, 1.7) * 13,
    HEL = (y, s = 0, r = 3.6) => {
      const a = y * 0.42 + s;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
  const along = (line, t) => {
    const x = clamp(t) * (line.length - 1),
      i = Math.min(line.length - 2, Math.floor(x));
    return v3(line[i], line[i + 1], x - i);
  };
  function* run(SMALL, COUNT) {
    // the tree is kept as it is: each of its parts starts from the same random number whatever the other scenes draw
    const KEEP =
        {
          s11000: { form4: 1185087672, stream4: 649668669, pane4: -1353735953, order: 135394975, line4: 1726399127, leaves: 89072996 },
          l18000: { form4: -538050394, stream4: -102169933, pane4: -1345856491, order: 143274437, line4: -2077376267, leaves: 1535137350 },
          l26000: { form4: 2004905646, stream4: -192334442, pane4: -932067724, order: 557063204, line4: 729469844, leaves: 47016165 },
        }[(SMALL ? "s" : "l") + COUNT] || {},
      keep = (n) => {
        if (KEEP[n] !== undefined) seed = KEEP[n];
      };
    // ---------- the tree: it grows towards points of light, the way a crown fills its sky ----------
    const LOBES = [
      [0.3, 6, 0, 3.7, 2.2, 3.4],
      [-5.3, 3, 0.8, 2.9, 1.8, 2.6],
      [5.1, 3.7, -0.4, 3.1, 1.9, 2.8],
      [1.2, 2.5, 4.7, 2.8, 1.5, 2.4],
      [-0.8, 3.6, -4.9, 3, 1.7, 2.4],
      [-3.1, 5.3, -1.2, 2.4, 1.6, 2.3],
      [3.2, 5.8, 1.3, 2.4, 1.5, 2.2],
      [6.9, 1.1, 1.8, 1.8, 1, 1.6],
      [-6.8, 0.6, -1.5, 1.9, 1, 1.7],
      [-3.3, 2, 3.9, 2.1, 1.2, 1.9],
      [3.9, 1.4, -4, 2, 1.1, 1.8],
    ];
    function* growTree(attractors) {
      const px = [],
        py = [],
        pz = [],
        par = [],
        kids = [];
      const node = (x, y, z, p) => {
        px.push(x);
        py.push(y);
        pz.push(z);
        par.push(p);
        kids.push([]);
        if (p >= 0) kids[p].push(px.length - 1);
        return px.length - 1;
      };
      const D = 0.34,
        trunk = [];
      for (let i = 0; i <= 16; i++) {
        const h = i / 16;
        trunk.push(node(Math.sin(h * 3.2) * 0.34 * h + 0.02, GROUND + i * D, Math.sin(h * 4.4 + 1) * 0.26 * h, i - 1));
      }
      const ax = [],
        ay = [],
        az = [];
      for (let i = 0; i < attractors; i++) {
        const l = LOBES[i % LOBES.length],
          d = norm([gauss(), gauss(), gauss()]),
          r = Math.pow(rnd(), 0.42);
        ax.push(l[0] + d[0] * l[3] * r);
        ay.push(l[1] + d[1] * l[4] * r);
        az.push(l[2] + d[2] * l[5] * r);
      }
      const near = ax.map(() => 0),
        nd = ax.map(() => 1e9),
        live = ax.map((_, i) => i);
      const check = (n) => {
        for (const a of live) {
          const d = (ax[a] - px[n]) ** 2 + (ay[a] - py[n]) ** 2 + (az[a] - pz[n]) ** 2;
          if (d < nd[a]) {
            nd[a] = d;
            near[a] = n;
          }
        }
      };
      for (const n of trunk.slice(9)) check(n);
      for (let it = 0; it < 120 && live.length; it++) {
        yield;
        const pull = new Map();
        for (const a of live) {
          const n = near[a],
            l = Math.sqrt(nd[a]) || 1;
          const p = pull.get(n) || [0, 0, 0];
          p[0] += (ax[a] - px[n]) / l;
          p[1] += (ay[a] - py[n]) / l;
          p[2] += (az[a] - pz[n]) / l;
          pull.set(n, p);
        }
        const fresh = [];
        for (const [n, p] of pull) {
          if (kids[n].length > 2) continue;
          const up = par[n] >= 0 ? norm([px[n] - px[par[n]], py[n] - py[par[n]], pz[n] - pz[par[n]]]) : [0, 1, 0];
          const d = norm([p[0] + up[0] * 0.9 + gauss() * 0.35, p[1] + up[1] * 0.9 + gauss() * 0.3, p[2] + up[2] * 0.9 + gauss() * 0.35]);
          const x = px[n] + d[0] * D,
            y = py[n] + d[1] * D,
            z = pz[n] + d[2] * D;
          if (kids[n].some((c) => (px[c] - x) ** 2 + (py[c] - y) ** 2 + (pz[c] - z) ** 2 < 0.03)) continue;
          fresh.push(node(x, y, z, n));
        }
        if (!fresh.length) break;
        for (const n of fresh) check(n);
        for (let i = live.length - 1; i >= 0; i--) if (nd[live[i]] < 0.27) live.splice(i, 1);
      }
      const N = px.length,
        r = new Float32Array(N),
        g = new Float32Array(N),
        main = new Int32Array(N).fill(-1);
      const R = 2.15;
      for (let i = N - 1; i >= 0; i--) {
        if (!kids[i].length) r[i] = 0.0125;
        else {
          let s = 0,
            b = 0;
          for (const c of kids[i]) {
            s += Math.pow(r[c], R);
            if (r[c] > b) {
              b = r[c];
              main[i] = c;
            }
          }
          r[i] = Math.pow(s, 1 / R) * 1.004;
        }
      }
      const k = 0.5 / r[2];
      for (let i = 0; i < N; i++) r[i] = Math.max(0.011, r[i] * lerp(1, k, smooth(0.02, 0.2, r[i])));
      for (let i = 0; i < 9; i++) r[i] *= 1 + 0.9 * Math.exp(-i * 0.62); // the trunk flares at the ground
      for (let pass = 0; pass < 2; pass++) {
        const x = px.slice(),
          y = py.slice(),
          z = pz.slice();
        for (let i = 1; i < N; i++) {
          const p = par[i],
            m = main[i];
          if (m < 0) continue;
          px[i] = x[i] * 0.5 + (x[p] + x[m]) * 0.25;
          py[i] = y[i] * 0.5 + (y[p] + y[m]) * 0.25;
          pz[i] = z[i] * 0.5 + (z[p] + z[m]) * 0.25;
        }
      }
      for (let i = 1; i < N; i++) g[i] = g[par[i]] + Math.hypot(px[i] - px[par[i]], py[i] - py[par[i]], pz[i] - pz[par[i]]);
      let gMax = 0;
      for (const x of g) gMax = Math.max(gMax, x);
      for (let i = 0; i < N; i++) g[i] = 0.06 + 0.86 * (g[i] / gMax);
      // one frame per node, carried from its parent, so fibres and bark never twist at a joint
      const dir = [],
        fr = [];
      for (let i = 0; i < N; i++) {
        const p = par[i],
          m = main[i];
        const a = p >= 0 ? p : i,
          b = m >= 0 ? m : i;
        dir[i] = norm([px[b] - px[a], py[b] - py[a], pz[b] - pz[a]]);
        let u = p >= 0 ? fr[p][0] : [1, 0, 0];
        u = norm(add(u, dir[i], -dot(u, dir[i])));
        fr[i] = [u, cross(dir[i], u)];
      }
      return { N, px, py, pz, par, kids, main, r, g, dir, fr, at: (i) => [px[i], py[i], pz[i]] };
    }
    // ---------- particle formations ----------
    const FORM = [
      // the sea: light in the water, denser near the camera; spray where the whale leaves it and where it comes back
      () => {
        if (rnd() < 0.16) return [rnd() * TAU, rnd(), rnd(), rnd() < 0.5 ? 2 : 3];
        const z = 20 - 86 * Math.pow(rnd(), 1.15),
          sp = 14 + (20 - z) * 1.1;
        return [(rnd() * 2 - 1 + gauss() * 0.25) * 0.8 * sp, rnd() < 0.05 ? Math.pow(rnd(), 2) * 7 : 0, z, rnd()];
      },
      // the storm: the wall of the rope, the dust it lifts, the cloud it hangs from, a loose sky
      () => {
        const u = rnd(),
          a = rnd() * TAU;
        if (u < 0.5) {
          const h = Math.pow(rnd(), 0.75);
          return [a, h, gauss() * 0.42 + (rnd() < 0.25 ? Math.abs(gauss()) * 1.3 : 0), h];
        }
        if (u < 0.74) {
          const r = 0.5 + Math.pow(rnd(), 1.5) * 11;
          return [a, (Math.abs(gauss()) * 2.3) / (1 + r * 0.42), r, -1];
        }
        if (u < 0.9) return [a, gauss() * 0.7, 4 + Math.pow(rnd(), 0.6) * 24, -2];
        const r = 10 + rnd() * 26;
        return [Math.cos(a) * r, gauss() * 9 + 4, Math.sin(a) * r, -3];
      },
      // the spine: sap on the cords, dust around them
      () => {
        const u = rnd(),
          y = (rnd() - 0.5) * 34,
          a = y * 0.42;
        if (u < 0.5) {
          const p = HEL(y, rnd() < 0.5 ? 0 : Math.PI),
            g = 0.22 + (rnd() < 0.25 ? 0.5 : 0);
          return [p[0] + gauss() * g, y + gauss() * g, p[2] + gauss() * g, rnd()];
        }
        if (u < 0.6) {
          const t = rnd() * 2 - 1;
          return [Math.cos(a) * 3.6 * t, y - 0.1, Math.sin(a) * 3.6 * t, 0.5];
        }
        const r = 5 + Math.abs(gauss()) * 7,
          b = rnd() * TAU;
        return [Math.cos(b) * r, y, Math.sin(b) * r, rnd()];
      },
      // the gate: light caught in the fibres, and the traffic through the opening
      () => {
        const u = rnd(),
          a = rnd() * TAU;
        if (u < 0.4) {
          const r = 4.4 + Math.pow(rnd(), 0.8) * 6;
          return [Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.16 - 0.3, 0.5];
        }
        if (u < 0.5) {
          const r = Math.sqrt(rnd()) * 4;
          return [Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.2, 0.5];
        }
        const z = -46 + rnd() * 70,
          r = z < 0 ? 2 + Math.abs(gauss()) * (1.5 - z * 0.2) : Math.sqrt(rnd()) * 3.8;
        return [Math.cos(a) * r, Math.sin(a) * r, z, z < 0 ? 0 : 1];
      },
      // the tree: sap on the branches, pollen in the crown, fireflies, dust on the soil
      () => {
        const u = rnd();
        if (u < 0.24) {
          const i = 20 + Math.floor(rnd() * (T.N - 20)),
            p = T.par[i],
            t = rnd(),
            a = rnd() * TAU,
            rr = T.r[i] * 1.05,
            f = T.fr[i];
          return [0, 1, 2]
            .map((j) => lerp([T.px, T.py, T.pz][j][p], [T.px, T.py, T.pz][j][i], t) + (f[0][j] * Math.cos(a) + f[1][j] * Math.sin(a)) * rr)
            .concat(T.g[i]);
        }
        if (u < 0.62) {
          const i = pick(twigIds),
            g = 0.5;
          return [T.px[i] + gauss() * g, T.py[i] + gauss() * g, T.pz[i] + gauss() * g, Math.min(0.99, T.g[i] + 0.05)];
        }
        if (u < 0.74) {
          const l = pick(LOBES),
            d = [gauss(), gauss(), gauss()];
          return [l[0] + d[0] * l[3] * 0.9, l[1] - 1.5 + d[1] * l[4], l[2] + d[2] * l[5] * 0.9, 1.2 + rnd() * 0.5];
        }
        if (u < 0.84) {
          const r = pick(ROOTS),
            q = r[Math.floor(rnd() * r.length)];
          return [q.p[0] + gauss() * 0.07, q.p[1] + gauss() * 0.05 + q.r, q.p[2] + gauss() * 0.07, q.g];
        }
        const a = rnd() * TAU,
          R = 0.6 + Math.pow(rnd(), 0.7) * 17;
        return [
          Math.cos(a) * R,
          GROUND - 0.05 + Math.abs(gauss()) * (rnd() < 0.3 ? 1.1 : 0.12),
          Math.sin(a) * R,
          u < 0.93 ? 0.02 + R * 0.004 : 2 + rnd() * 0.5,
        ];
      },
      // the planet: lights on land, a thin shell of satellites
      () => {
        const c = cities[Math.floor(Math.pow(rnd(), 1.4) * cities.length)],
          u = rnd();
        let p;
        if (u < 0.62) {
          const g = 0.012 + 0.03 * c.w;
          p = c.q.map((x) => x + gauss() * g);
        } else if (u < 0.84) {
          const d = cities[pick(c.near)],
            t = rnd();
          p = c.q.map((x, i) => lerp(x, d.q[i], t) + gauss() * 0.0025);
        } else p = [gauss(), Math.abs(gauss()), gauss()];
        const l = Math.hypot(...p),
          R = (PR * 1.006) / l;
        return [PC[0] + p[0] * R, PC[1] + p[1] * R, PC[2] + p[2] * R, u < 0.84 ? 0.6 + 0.4 * c.w : 0];
      },
    ];

    // ---------- streams of light: curves that change chapter with the particles ----------
    const bez = (a, b, c, d, t) =>
      [0, 1, 2].map((j) => {
        const u = 1 - t;
        return u * u * u * a[j] + 3 * u * u * t * b[j] + 3 * u * t * t * c[j] + t * t * t * d[j];
      });
    const STREAM = [
      // the sea: water pouring off the whale's path, and currents running to the moon
      (s) => {
        if (s < 10) {
          const off = gauss() * 0.9,
            o2 = gauss() * 0.8,
            a = 0.5 + rnd() * 0.3,
            b = a + 0.9 + rnd() * 1.1;
          return (t) => {
            const th = lerp(a, b, t);
            return [-13.5 * Math.cos(th) + off * 0.4, -5.2 + (12.2 + off) * Math.sin(th) - t * 0.5, -15 + 3 * Math.sin(th * 1.3) + o2];
          };
        }
        const x0 = gauss() * 12,
          w = 1.5 + rnd() * 3,
          f = 2 + rnd() * 3,
          ph = rnd() * TAU;
        return (t) => {
          const z = lerp(0, -52, t);
          return [x0 * 1.6 * lerp(1, 0.08, t) + Math.sin(t * f * 3 + ph) * w * (1 - t * 0.6), 0.12, z];
        };
      },
      (s) => {
        const a0 = (s / NS) * TAU * 3,
          h0 = (s % 5) * 0.17 + rnd() * 0.06,
          span = 0.22 + rnd() * 0.2,
          turns = 0.75 + rnd() * 0.5,
          off = 0.04 + (s % 3) * 0.22;
        return (t) => {
          const h = Math.min(0.98, h0 + span * t);
          return [a0 - t * turns * TAU, h, off * (0.4 + h * 1.6)];
        };
      },
      (s) => {
        if (s < 2) return (t) => HEL((t - 0.5) * 34, s * Math.PI);
        const a0 = rnd() * TAU,
          r = 5 + rnd() * 9,
          y0 = (rnd() - 0.5) * 26,
          tw = 0.8 + rnd() * 1.4,
          rise = 6 + rnd() * 12;
        return (t) => [Math.cos(a0 + t * tw * 3) * lerp(r, 3.7, t), y0 + t * rise - 6, Math.sin(a0 + t * tw * 3) * lerp(r, 3.7, t)];
      },
      () => {
        const a = rnd() * TAU,
          r = 1 + rnd() * 2.6,
          w = 6 + rnd() * 16,
          ph = rnd() * TAU,
          b = [Math.cos(a) * r, Math.sin(a) * r];
        return (t) => {
          const z = lerp(-48, 24, t),
            k = Math.pow(clamp(-z / 48), 1.1) * 0.6;
          return [b[0] + Math.cos(ph + z * 0.17) * w * k, b[1] + Math.sin(ph * 2 + z * 0.13) * w * k, z];
        };
      },
      // the tree: light climbing from a root tip to a twig
      (s) => {
        const r = ROOTS[(s * 4) % ROOTS.length].map((q) => [q.p[0], q.p[1] + q.r, q.p[2]]).reverse(),
          p = pathOf(tipIds[Math.floor(((s + 0.5) / NS) * tipIds.length)]),
          a = rnd() * TAU;
        const line = [
          ...r,
          ...p.slice(2).map((i) => {
            const b = a + T.py[i] * 0.35;
            return add(add(T.at(i), T.fr[i][0], Math.cos(b) * (T.r[i] + 0.02)), T.fr[i][1], Math.sin(b) * (T.r[i] + 0.02));
          }),
        ];
        return (t) => along(line, t);
      },
      () => {
        const A0 = pick(cities);
        let B0 = A0;
        for (let k = 0; k < 60; k++) {
          B0 = pick(cities);
          const d = dot(A0.q, B0.q);
          if (d < 0.93 && d > 0.6) break;
        }
        const a = A0.q,
          b = B0.q;
        const dt = clamp(dot(a, b), -1, 1),
          om = Math.acos(dt),
          so = Math.sin(om) || 1,
          lift = 0.03 + om * 0.16;
        return (t) => {
          const A = Math.sin((1 - t) * om) / so,
            B = Math.sin(t * om) / so,
            R = PR * (1 + Math.sin(Math.PI * t) * lift);
          return [0, 1, 2].map((j) => PC[j] + (a[j] * A + b[j] * B) * R);
        };
      },
    ];

    // ---------- glass pages: position, size, and turn (yaw, pitch, roll) ----------
    seed = 4242;
    const BOATS = [];
    for (let i = 0; i < 160 && BOATS.length < 22; i++) {
      const z = 8.5 - rnd() * 44,
        x = gauss() * (4.5 + (12 - z) * 0.44);
      if (Math.abs(x) > 1.8 && BOATS.every((b) => Math.hypot(b[0] - x, b[1] - z) > 3.2)) BOATS.push([x, z, rnd() * TAU, 0.8 + rnd() * 0.5]);
    }
    BOATS.sort((a, b) => b[1] - a[1]);
    const BOATMESH = (() => {
      const v = [],
        P = {
          bow: [-1.5, 0.68, 0],
          st: [1.5, 0.68, 0],
          k0: [-0.82, -0.12, 0],
          k1: [0.82, -0.12, 0],
          l: [0, 0.5, 0.52],
          r: [0, 0.5, -0.52],
          top: [0, 1.6, 0],
          a: [-0.7, 0.5, 0],
          b: [0.7, 0.5, 0],
        };
      const tri = (p, q, r, sail) => {
        const A = P[p],
          B = P[q],
          C = P[r],
          n = norm(cross(sub(B, A), sub(C, A)));
        [A, B, C].forEach((x, i) => v.push(...x, sail, ...n, i));
      };
      for (const s of ["l", "r"]) {
        tri("bow", "k0", s, 0);
        tri("k0", "k1", s, 0);
        tri("k1", "st", s, 0);
        tri("a", s, "top", 1);
        tri(s, "b", "top", 1);
      }
      return new Float32Array(v);
    })();
    const PANEL = [
      (i) => {
        const z = 6 - Math.pow(rnd(), 0.8) * 48,
          sp = 5 + (16 - z) * 0.6;
        return [
          gauss() * sp,
          i % 9 ? 0.03 : 1.5 + Math.abs(gauss()) * 3,
          z,
          i % 3 ? 0 : 0.42 + rnd() * 0.4,
          rnd() * TAU,
          i % 9 ? 1.5 + gauss() * 0.07 : gauss() * 0.6,
          gauss() * 0.12,
        ];
      },
      (i) => {
        const h = 0.12 + 0.85 * Math.pow(rnd(), 0.58),
          a = rnd() * TAU;
        return [a, h, 0.5 + Math.abs(gauss()) * (0.5 + 1.9 * h), (i % 4 ? 0.24 : 0.6) + rnd() * 0.3, -a, gauss() * 0.35, gauss() * 0.5];
      },
      (i) => {
        const y = (i / NG - 0.5) * 32,
          a = y * 0.42 + (i % 2 ? Math.PI : 0);
        const r = 5.1;
        return [
          Math.cos(a) * r,
          y + 0.55,
          Math.sin(a) * r,
          i % 2 && i % 4 !== 1 ? 0 : 0.52 + rnd() * 0.14,
          -a + Math.PI / 2 + gauss() * 0.2,
          -0.12 + gauss() * 0.12,
          gauss() * 0.12,
        ];
      },
      (i) => {
        const lane = i % 5,
          z = -44 + Math.floor(i / 5) * 2.85 + lane * 0.57 + gauss() * 0.5,
          ang = (lane / 5) * TAU + 0.4,
          r = z < 0 ? 2.7 - z * 0.1 : 2.8 + z * 0.06;
        return [
          Math.cos(ang) * r + (z < 0 ? gauss() * -z * 0.09 : 0),
          Math.sin(ang) * r * 0.86 + (z < 0 ? gauss() * -z * 0.07 : 0) - (z > 0 ? z * 0.03 : 0),
          z,
          i % 2 || i === HELD ? 0.5 + rnd() * 0.16 : 0,
          z < 0 ? gauss() * 0.6 : 0,
          z < 0 ? gauss() * 0.5 : 0,
          z < 0 ? gauss() * 0.5 : 0,
        ];
      },
      (i) => {
        const l = LANTERN[i % LANTERN.length],
          on = i < LANTERN.length;
        return [l.q[0], l.q[1] - l.s * 0.82, l.q[2], on ? l.s : 0, Math.atan2(l.q[0], l.q[2]) * 0.8 + gauss() * 0.25, 0, 0];
      },
      (i) => {
        const a = (i / NG) * TAU,
          r = PR * 1.18,
          tilt = 0.42,
          x = Math.cos(a) * r,
          z = Math.sin(a) * r;
        return [PC[0] + x * Math.cos(tilt), PC[1] + x * Math.sin(tilt), PC[2] + z, 0, -a + Math.PI / 2, 0, tilt];
      },
    ];

    // ---------- the first scene is made and handed over before the tree begins to grow ----------
    seed = 77;
    const rows = Math.ceil(COUNT / 256),
      layer = 256 * rows * 4,
      formOf = (k) => {
        const f = new Float32Array(layer);
        for (let i = 0; i < COUNT; i++) f.set(FORM[k](), i * 4);
        return f;
      },
      lineOf = (k) => {
        const l = new Float32Array(NP * NS * 4);
        for (let s = 0; s < NS; s++) {
          const f = STREAM[k](s);
          for (let i = 0; i < NP; i++) l.set(f(i / (NP - 1)), (s * NP + i) * 4);
        }
        return l;
      },
      paneOf = (k) => {
        const p = new Float32Array(NG * 8);
        for (let i = 0; i < NG; i++) {
          const q = PANEL[k](i);
          p.set(q.slice(0, 4), i * 4);
          p.set(q.slice(4), (NG + i) * 4);
        }
        return p;
      };
    const form0 = formOf(0),
      line0 = lineOf(0),
      pane0 = paneOf(0);
    keep("order");
    const order = new Float32Array(COUNT).map((_, i) => i);
    for (let i = COUNT - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)),
        t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    const stars = new Float32Array(1100 * 4);
    for (let i = 0; i < 1100; i++) stars.set([...norm([gauss(), gauss() * 0.8 + 0.12, gauss()]), rnd()], i * 4);
    const noise = new Uint8Array(32768).map(() => rnd() * 256);
    yield {
      count: COUNT,
      rows,
      form: form0,
      line: line0,
      pane: pane0,
      order,
      stars,
      noise,
      boatMesh: BOATMESH,
      fleet: new Float32Array(BOATS.flat()),
      boats: BOATS.slice(0, 8),
    };
    seed = 20261124;
    const T = yield* growTree(SMALL ? 900 : 1900);
    const tipIds = [...Array(T.N).keys()].filter((i) => !T.kids[i].length),
      twigIds = [...Array(T.N).keys()].filter((i) => T.r[i] < 0.05 && T.py[i] > -1.4);
    const pathOf = (i) => {
      const p = [];
      for (; i >= 0; i = T.par[i]) p.push(i);
      return p.reverse();
    };
    const trunkLine = (() => {
      let b = 0,
        d = 1e9;
      for (let i = 0; i < T.N; i++) {
        const e = Math.hypot(T.px[i] - 0.2, T.py[i] - 2.6, T.pz[i] - 0.2);
        if (e < d && T.r[i] > 0.03) {
          d = e;
          b = i;
        }
      }
      return pathOf(b).map((i) => [...T.at(i), T.g[i]]);
    })();
    // roots: they leave the flare, run along the soil and go under
    const ROOTS = [];
    for (let r = 0; r < 13; r++) {
      const a = (r / 13) * TAU + gauss() * 0.14,
        walk = (p, d, n, w, g) => {
          const pts = [];
          for (let i = 0; i <= n; i++) {
            pts.push({ p: p.slice(), r: w * Math.pow(1 - i / (n + 1), 0.8) + 0.012, g: g + i * 0.0075 });
            d = norm([d[0] + gauss() * 0.2, d[1] + gauss() * 0.1 - (p[1] > GROUND - 0.06 ? 0.12 : -0.02), d[2] + gauss() * 0.2]);
            d[1] *= 0.72;
            p = add(p, d, 0.44);
          }
          ROOTS.push(pts);
          return pts;
        };
      const m = walk(
        [Math.cos(a) * 0.42, GROUND + 0.34 + rnd() * 0.2, Math.sin(a) * 0.42],
        norm([Math.cos(a), -0.55, Math.sin(a)]),
        15 + Math.floor(rnd() * 7),
        0.17 + rnd() * 0.1,
        0,
      );
      for (const s of [4, 7, 11]) {
        const q = m[s],
          b = a + (rnd() < 0.5 ? 1 : -1) * (0.5 + rnd() * 0.5);
        walk(q.p, norm([Math.cos(b), -0.15, Math.sin(b)]), 8 + Math.floor(rnd() * 5), q.r * 0.6, q.g);
      }
    }

    // lanterns: a page hung on a thread under the crown
    const LANTERN = (() => {
      const out = [];
      const spots = mixed(twigIds).filter((i) => T.py[i] < 3.4 && T.py[i] > -0.2);
      for (const i of spots) {
        const p = T.at(i),
          drop = 0.7 + rnd() * 1.5;
        if (Math.hypot(p[0], p[2]) < 2.2) continue;
        const q = [p[0], p[1] - drop, p[2]];
        if (out.every((o) => Math.hypot(o.q[0] - q[0], o.q[1] - q[1], o.q[2] - q[2]) > 1.75)) out.push({ p, q, g: T.g[i], s: 0.46 + rnd() * 0.24 });
        if (out.length === 30) break;
      }
      return out;
    })();

    // ---------- the planet's cities ----------
    const land = (x, y, z) =>
      Math.sin(x * 2.1 + 1.3) * Math.cos(y * 2.7 - 0.4) +
      Math.sin(z * 2.4 + y * 1.6) * 0.8 +
      Math.sin(x * 5.3 + z * 4.1) * 0.35 +
      Math.cos(y * 6.1 - x * 3.7) * 0.3;
    const FRONT = norm([0, 14.7, 18]);
    const cities = [];
    while (cities.length < 170) {
      const q = norm([gauss(), gauss(), gauss()]);
      if (dot(q, FRONT) < 0.3 || land(q[0] * 2.6 + 1, q[1] * 2.6, q[2] * 2.6) < 0.05 - rnd() * 0.4) continue;
      cities.push({ q, w: Math.pow(rnd(), 3) });
    }
    cities.forEach((c, i) => {
      c.near = cities
        .map((d, j) => [j, dot(c.q, d.q)])
        .filter(([j]) => j !== i)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([j]) => j);
    });

    // ---------- linework: every hairline of a chapter, as segments ----------
    // one segment: a xyz + when it lights, b xyz + when, colour, width, seed
    const LINES = function* () {
      const S = [[], [], [], [], [], [], []];
      let cur = S[0],
        sd = 0;
      const C3 = (h, k = 1) => hex(h).map((x) => x * k);
      const seg = (a, b, ga, gb, c, w, s = sd) => cur.push(a[0], a[1], a[2], ga, b[0], b[1], b[2], gb, c[0], c[1], c[2], w, s);
      const poly = (pts, g0, g1, c, w) => {
        sd = rnd();
        for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], lerp(g0, g1, i / (pts.length - 1)), lerp(g0, g1, (i + 1) / (pts.length - 1)), c, w);
      };
      const circle = (n, f, g0, g1, c, w, dash = 0) => {
        sd = rnd();
        for (let i = 0; i < n; i++) if (!dash || i % dash) seg(f((i / n) * TAU), f(((i + 1) / n) * TAU), lerp(g0, g1, i / n), lerp(g0, g1, (i + 1) / n), c, w);
      };
      yield;
      // the storm: threads between the copies, broken where they disagree
      cur = S[1];
      const cop = [
        [-4.6, 2.6, 2.4],
        [5.4, 7.2, 1],
        [3.1, -0.6, 4],
        [-4.4, 8.4, -2],
      ];
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
          const a = cop[i],
            b = cop[j],
            m = add(add(a, b), [0, 3 + rnd() * 2, 0]).map((x) => x / 2),
            pts = [];
          for (let t = 0; t <= 26; t++) {
            const p = bez(a, m, m, b, t / 26);
            pts.push(p);
          }
          sd = rnd();
          for (let t = 0; t < 26; t++)
            if (t % 3) seg(pts[t], pts[t + 1], 0.25 + j * 0.12 + t * 0.006, 0.25 + j * 0.12 + t * 0.006, C3(i + j > 3 ? "#ff5b86" : "#8fa4ff", 0.34), 0.008);
        }
      // the spine: two cords twisted from fibres of light, threads between them, a stem to each page
      cur = S[2];
      const ice = C3("#8fd8f5"),
        blue = C3("#2f7fd8"),
        gold = C3("#ffcf8a"),
        FN = SMALL ? 20 : 40,
        FS = SMALL ? 64 : 92;
      for (const st of [0, Math.PI])
        for (let f = 0; f < FN; f++) {
          const ph = (f / FN) * TAU + rnd() * 0.5,
            w0 = 0.06 + Math.pow(rnd(), 0.7) * 0.5,
            tw = (1.1 + rnd() * 0.9) * (f % 7 ? 1 : -0.8),
            y0 = -17 + rnd() * 3,
            y1 = 17 - rnd() * 3,
            k = 0.16 + rnd() * 0.34,
            c = (f % 6 === 0 ? gold : f % 3 ? ice : blue).map((x) => x * k),
            drift = gauss() * 0.25;
          let p = null;
          sd = rnd();
          for (let i = 0; i <= FS; i++) {
            const y = lerp(y0, y1, i / FS),
              end = smooth(12, 17, Math.abs(y)),
              w = w0 * (1 + 0.35 * Math.sin(y * 0.5 + ph)) + end * (1 + 1.6 * rnd() * 0.2) * (w0 * 2.4),
              b = ph + y * tw + drift * Math.sin(y * 0.3),
              a = y * 0.42 + st,
              n = [Math.cos(a), 0, Math.sin(a)],
              t = norm([-Math.sin(a) * 1.5, 1, Math.cos(a) * 1.5]),
              q = cross(t, n),
              P = add(add(HEL(y, st), n, Math.cos(b) * w), q, Math.sin(b) * w);
            if (p) seg(p, P, (y + 13.8) / 28, (y + 14) / 28, c, 0.011);
            p = P;
          }
          if ((f & 7) === 0) yield;
        }
      for (let i = 0; i < 44; i++) {
        const y = -16.4 + i * 0.76,
          A = HEL(y, 0),
          B = HEL(y, Math.PI),
          g = (y + 14) / 28;
        for (let h = 0; h < 2; h++) {
          sd = rnd();
          const sag = 0.12 + rnd() * 0.3,
            o = gauss() * 0.1,
            c = (h ? ice : i % 5 ? blue : gold).map((x) => x * (h ? 0.2 : 0.42));
          let p = null;
          for (let t = 0; t <= 10; t++) {
            const u = t / 10,
              q = v3(A, B, u);
            q[1] += o + Math.sin(u * Math.PI) * -sag;
            q[0] += Math.sin(u * 9 + i) * 0.04;
            if (p && Math.abs(u - 0.5) > 0.05) seg(p, q, g + Math.abs(u - 0.5) * 0.02, g + Math.abs(u - 0.5) * 0.02, c, 0.009);
            p = q;
          }
        }
      }
      for (let i = 0; i < NG; i++) {
        if (i % 2 && i % 4 !== 1) continue;
        const y = (i / NG - 0.5) * 32,
          s = i % 2 ? Math.PI : 0,
          g = (y + 14) / 28,
          a = HEL(y - 0.5, s - 0.1, 3.7),
          b = HEL(y + 0.42, s + 0.02, 4.75),
          m = add(v3(a, b, 0.5), [0, -0.3, 0]);
        sd = rnd();
        let p = a;
        for (let t = 1; t <= 6; t++) {
          const q = bez(a, m, m, b, t / 6);
          seg(
            p,
            q,
            g + t * 0.004,
            g + t * 0.004,
            ice.map((x) => x * 0.5),
            0.01,
          );
          p = q;
        }
      }
      yield;
      // the gate: an iris, fibres of light around an opening; it lights from the rim to the pupil
      cur = S[3];
      const IN = 4.35,
        OUT = 10.4,
        deep3 = C3("#2450c8"),
        mid3 = C3("#5aa8f0"),
        pale3 = C3("#c4e6ff"),
        gold3 = C3("#ffca86"),
        conv = (r) => -0.75 + 0.72 * Math.sin(clamp((r - IN) / (OUT - IN)) * Math.PI * 0.5),
        NF = SMALL ? 260 : 520;
      const at3 = (r, a) => [Math.cos(a) * r, Math.sin(a) * r, conv(r)];
      for (let f = 0; f < NF; f++) {
        const a0 = (f / NF) * TAU + gauss() * 0.006,
          r0 = f % 5 === 0 ? lerp(IN, OUT, 0.25 + rnd() * 0.35) : IN + Math.abs(gauss()) * 0.22,
          r1 = f % 4 ? OUT - Math.abs(gauss()) * 0.35 : lerp(IN, OUT, 0.5 + rnd() * 0.4),
          w1 = gauss() * 0.022,
          w2 = gauss() * 0.006,
          fq = 0.5 + rnd() * 0.7,
          ph = rnd() * TAU,
          k = 0.16 + Math.pow(rnd(), 1.6) * 0.7,
          n = SMALL ? 10 : 14;
        sd = rnd();
        let p = null;
        for (let i = 0; i <= n; i++) {
          const t = i / n,
            r = lerp(r1, r0, t),
            x = (r - IN) / (OUT - IN),
            a = a0 + w1 * Math.sin(r * fq + ph) + w2 * Math.sin(r * fq * 2.7 + ph * 2),
            P = at3(r, a);
          if (p) {
            const c = x > 0.62 ? v3(mid3, deep3, (x - 0.62) / 0.38) : x > 0.22 ? v3(pale3, mid3, (x - 0.22) / 0.4) : v3(gold3, pale3, x / 0.22);
            const g = 0.02 + (1 - x) * 0.46;
            seg(
              p,
              P,
              g,
              g + 0.04,
              c.map((v) => v * k * (x > 0.85 ? 0.8 : 1)),
              0.011,
            );
          }
          p = P;
        }
        if ((f & 63) === 0) yield;
      }
      // the ruff around the pupil, the folds, and the rim
      for (const [r, amp, n, c, w] of [
        [IN + 1.15, 0.34, 150, gold3.map((x) => x * 0.5), 0.012],
        [IN + 1.3, 0.26, 110, pale3.map((x) => x * 0.28), 0.01],
        [IN - 0.02, 0.04, 120, gold3.map((x) => x * 0.8), 0.016],
      ]) {
        sd = rnd();
        const z = [...Array(n)].map(() => gauss() * amp);
        let p = null;
        for (let i = 0; i <= n; i++) {
          const P = at3(r + z[i % n], (i / n) * TAU);
          if (p) seg(p, P, 0.4, 0.42, c, w);
          p = P;
        }
      }
      for (let q = 0; q < 26; q++) {
        const r = lerp(6.6, 9.6, rnd()),
          a = rnd() * TAU,
          span = 0.25 + rnd() * 0.7,
          n = 14;
        sd = rnd();
        let p = null;
        for (let i = 0; i <= n; i++) {
          const P = at3(r + Math.sin(i * 0.9 + q) * 0.035, a + (i / n) * span);
          if (p)
            seg(
              p,
              P,
              0.3,
              0.32,
              mid3.map((x) => x * 0.2),
              0.009,
            );
          p = P;
        }
      }
      for (const [r, k] of [
        [OUT, 0.8],
        [OUT + 0.14, 0.3],
        [OUT + 0.42, 0.12],
      ])
        circle(
          180,
          (a) => at3(r, a),
          0,
          0.02,
          mid3.map((x) => x * k * 0.6),
          0.014,
          r > OUT + 0.2 ? 3 : 0,
        );
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU + gauss() * 0.01,
          l = 0.25 + Math.pow(rnd(), 2) * 1.5;
        sd = rnd();
        seg(
          at3(OUT + 0.55, a),
          at3(OUT + 0.55 + l, a),
          0,
          0.01,
          deep3.map((x) => x * 0.5),
          0.01,
        );
      }
      yield;
      // the tree: fibres from a root tip to a twig, every fine branch, threads for the lanterns, the year around the crown
      keep("line4");
      cur = S[4];
      const fib = SMALL ? 70 : 170;
      for (let f = 0; f < fib; f++) {
        if (f % 20 === 0) yield;
        const tip = tipIds[Math.floor(((f + rnd()) / fib) * tipIds.length)],
          path = pathOf(tip);
        const end = T.at(tip),
          a0 = Math.atan2(end[2], end[0]) + gauss() * 0.45,
          pts = [],
          gs = [];
        for (const i of path) {
          if (T.r[i] < 0.03) break;
          const b = a0 - T.py[i] * 0.28 + 1.2,
            R = T.r[i] * (1.02 + 0.05 * Math.sin(f * 7 + i)) + 0.008;
          pts.push(add(add(T.at(i), T.fr[i][0], Math.cos(b) * R), T.fr[i][1], Math.sin(b) * R));
          gs.push(T.g[i]);
        }
        sd = rnd();
        const k = 0.22 + rnd() * 0.4,
          c = f % 6 ? C3("#4fd39c", k) : C3("#ffd28a", k * 1.1);
        for (let i = 0; i + 1 < pts.length; i++) {
          const thick = 1 - 0.88 * smooth(0.028, 0.15, T.r[path[i]]);
          seg(
            pts[i],
            pts[i + 1],
            gs[i],
            gs[i + 1],
            c.map((x) => x * thick),
            0.01,
          );
        }
      }
      for (let i = 15; i < T.N; i++)
        if (T.r[i] < 0.075) {
          const p = T.par[i];
          sd = (i * 0.618) % 1;
          seg(T.at(p), T.at(i), T.g[p], T.g[i], C3("#3fae7e", 0.34), T.r[i] * 1.6);
        }
      yield;
      for (const r of ROOTS) {
        sd = rnd();
        for (let i = 0; i + 1 < r.length; i++)
          for (const o of [-0.6, 0.5]) {
            const A = r[i],
              B = r[i + 1];
            seg(
              [A.p[0] + o * A.r, A.p[1] + A.r * 0.9, A.p[2] - o * A.r],
              [B.p[0] + o * B.r, B.p[1] + B.r * 0.9, B.p[2] - o * B.r],
              A.g,
              B.g,
              C3(o > 0 ? "#ffc978" : "#4fd39c", 0.26),
              0.01,
            );
          }
      }
      for (const l of LANTERN) {
        sd = rnd();
        seg(l.p, l.q, l.g + 0.04, l.g + 0.07, C3("#ffd9a0", 0.55), 0.01);
        const w = l.s * 0.2;
        seg([l.q[0] - w, l.q[1], l.q[2]], [l.q[0] + w, l.q[1], l.q[2]], l.g + 0.06, l.g + 0.07, C3("#ffd9a0", 0.9), 0.016);
      }
      const ring = (r, y, tilt) => (a) => [Math.cos(a) * r, y + Math.sin(a) * Math.sin(tilt) * r * 0.16, Math.sin(a) * r];
      for (const [r, k] of [
        [11.2, 0.5],
        [11.5, 0.16],
      ])
        circle(140, ring(r, 1.2, 1), 0.3, 0.9, C3("#4fd39c", k * 0.6), 0.012, r > 11.3 ? 3 : 0);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU,
          big = i % 4 === 0;
        seg(
          ring(11.2, 1.2, 1)(a),
          ring(big ? 12 : 11.5, 1.2, 1)(a),
          0.3 + (i / 48) * 0.6,
          0.3 + (i / 48) * 0.6,
          C3(i < 12 ? "#ffd1e6" : i < 24 ? "#7be7b2" : i < 36 ? "#ffb44d" : "#a9d8ff", big ? 0.42 : 0.2),
          big ? 0.016 : 0.01,
        );
      }
      yield;
      // the light over the planet: orbits with their marks, links between cities
      cur = S[5];
      cities.forEach((c, i) => {
        if (c.w > 0.12)
          for (const j of c.near.slice(0, 2)) {
            const d = cities[j],
              pts = [];
            for (let t = 0; t <= 8; t++) {
              const q = norm(v3(c.q, d.q, t / 8));
              pts.push([0, 1, 2].map((x) => PC[x] + q[x] * PR * (1.008 + Math.sin((t / 8) * Math.PI) * 0.006)));
            }
            poly(pts, 0.2 + i * 0.003, 0.24 + i * 0.003, C3("#ffb765", 0.35), 0.012);
          }
      });
      // lightning: four bolts, each with its own seed
      cur = S[6];
      for (let b = 0; b < 4; b++) {
        sd = b;
        const a = (b / 4) * TAU + 0.7;
        let p = [Math.cos(a) * 9, 14, Math.sin(a) * 9 - 3];
        const end = [Math.cos(a + 0.5) * 15, -7.4, Math.sin(a + 0.5) * 13 - 3];
        for (let i = 0; i < 24; i++) {
          const t = (i + 1) / 24,
            q = add(v3(p, end, 1 / (24 - i)), [gauss() * 0.75, gauss() * 0.2, gauss() * 0.75]);
          seg(p, q, i / 24, t, [5, 6, 9], 0.085 * (1 - t * 0.5));
          if (i % 5 === 3) {
            let r = q;
            const d = [gauss() * 0.9, -0.8, gauss() * 0.9];
            for (let j = 0; j < 5; j++) {
              const n = add(add(r, d, 0.75), [gauss() * 0.3, 0, gauss() * 0.3]);
              seg(r, n, t, t + j * 0.04, [2, 2.5, 4], 0.03);
              r = n;
            }
          }
          p = q;
        }
      }
      return S.map((s) => new Float32Array(s));
    };

    // ---------- leaves, blossom and grass ----------
    const LEAVES = function* () {
      const d = [];
      const n = SMALL ? 2000 : 6400,
        push = (p, g, dir, s, asp, hue) => d.push(p[0], p[1], p[2], g, dir[0], dir[1], dir[2], s, asp, hue);
      for (let i = 0; i < n; i++) {
        if ((i & 511) === 0) yield;
        const t = i < tipIds.length * 2 ? tipIds[i % tipIds.length] : pick(twigIds),
          f = T.dir[t],
          out = norm(add(add(f, norm([gauss(), gauss() * 0.5 - 0.12, gauss()]), 1.1), norm([T.px[t], 0, T.pz[t]]), 0.35));
        push(add(T.at(t), [gauss(), gauss() * 0.7, gauss()], 0.13), T.g[t] + rnd() * 0.07, out, 0.17 + rnd() * 0.13, 0.5, rnd());
      }
      const grass = SMALL ? 700 : 2200;
      for (let i = 0; i < grass; i++) {
        const a = rnd() * TAU,
          r = 0.75 + Math.pow(rnd(), 0.62) * 12,
          h = (0.16 + rnd() * 0.34) * (1 + 1.1 * Math.exp(-r * 0.3));
        push(
          [Math.cos(a) * r, GROUND - 0.1, Math.sin(a) * r],
          0.02 + r * 0.012,
          norm([gauss() * 0.35, 1, gauss() * 0.35]),
          h,
          0.022 + rnd() * 0.022,
          2 + rnd(),
        );
      }
      return new Float32Array(d);
    };

    // ---------- bark: tubes for everything thick enough to have a surface ----------
    const BARK = function* () {
      const v = [],
        ix = [];
      const ring = (c, u, w, r, n, S, g, lines) => {
        const o = v.length / 10;
        for (let s = 0; s <= S; s++) {
          const a = (s / S) * TAU,
            x = Math.cos(a),
            y = Math.sin(a);
          v.push(c[0], c[1], c[2], r, u[0] * x + w[0] * y, u[1] * x + w[1] * y, u[2] * x + w[2] * y, s / S, g, lines);
        }
        return o;
      };
      const join = (a, b, S) => {
        for (let s = 0; s < S; s++) ix.push(a + s, b + s, a + s + 1, a + s + 1, b + s, b + s + 1);
      };
      const done = new Uint8Array(T.N);
      yield;
      for (let s = 0; s < T.N; s++) {
        if (done[s] || T.r[s] < 0.042) continue;
        if (s && T.main[T.par[s]] === s) continue;
        const ids = s ? [T.par[s]] : [];
        for (let i = s; i >= 0 && T.r[i] > 0.038; i = T.main[i]) {
          ids.push(i);
          done[i] = 1;
        }
        if (ids.length < 2) continue;
        const S = T.r[s] > 0.25 ? 16 : T.r[s] > 0.1 ? 9 : 6,
          lines = Math.max(5, Math.round(T.r[s] * 74));
        let prev = -1;
        ids.forEach((i, j) => {
          const rr = j === 0 && s ? Math.min(T.r[i], T.r[s] * 1.5) : T.r[i];
          const fr = j === 0 && s ? T.fr[s] : T.fr[i];
          const o = ring(T.at(i), fr[0], fr[1], rr, 0, S, T.g[i], lines);
          if (prev >= 0) join(prev, o, S);
          prev = o;
        });
      }
      for (const r of ROOTS) {
        let prev = -1,
          u = [0, 1, 0];
        r.forEach((q, i) => {
          const d = norm(sub(r[Math.min(i + 1, r.length - 1)].p, r[Math.max(i - 1, 0)].p));
          u = norm(add(u, d, -dot(u, d)));
          const o = ring(q.p, u, cross(d, u), q.r, 0, 7, q.g, 8);
          if (prev >= 0) join(prev, o, 7);
          prev = o;
        });
      }
      return { v: new Float32Array(v), ix: new Uint32Array(ix) };
    };

    // ---------- everything else the renderer uploads ----------
    const form = [],
      line = [],
      pane = [];
    for (let k = 1; k < K; k++) {
      if (k === 4) keep("form4");
      form.push(formOf(k));
      yield;
      if (k === 4) keep("stream4");
      line.push(lineOf(k));
      yield;
      if (k === 4) keep("pane4");
      pane.push(paneOf(k));
    }
    const segs = yield* LINES();
    yield;
    keep("leaves");
    const leaves = yield* LEAVES();
    const bark = yield* BARK();
    return { form, line, pane, segs, leaves, bark, trunkLine, lanterns: LANTERN, cities: cities.map((c) => c.q) };
  }
  return { TAU, clamp, lerp, smooth, smoother, v3, sub, cross, dot, norm, add, hex, K, PC, PR, GROUND, NS, NP, NG, HELD, FUN, HEL, along, run };
}

export const { clamp, lerp, smooth, smoother, v3, sub, cross, dot, norm, hex, TAU, K, PC, PR, NS, NP, NG, HELD, along } = Geo();
