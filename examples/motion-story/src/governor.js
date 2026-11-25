import { clamp } from "./geo.js";

// ---------- the governor: picture size follows the frame time, so frames are not dropped ----------
// idle: the refresh measured before anything was drawn. Safari gives 30 a second in low power mode, and in an embedded page until it is touched: that is a limit, not a slow device.
export function governor(world, small, idle) {
  const RATES = [6.94, 8.33, 11.11, 16.67, 33.33],
    snap = (x) => RATES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const min = small ? 0.46 : 0.42,
    start = small ? 0.78 : 0.86;
  let q = start,
    cap = 1,
    dts = [],
    sum = 0,
    period = snap(idle || 16.67),
    good = 0,
    half = false,
    skip = false,
    capAt = -1e9,
    detail = 1,
    hopeless = 0,
    ref = null,
    hold = 0,
    capped = 0,
    probe = null,
    wait = 20000;
  const log = [];
  const lower = (f, now) => {
    q = Math.max(min, q * f);
    cap = Math.min(cap, q * 1.06);
    capAt = now;
    good = 0;
  };
  return {
    get q() {
      return q;
    },
    get half() {
      return half;
    },
    get period() {
      return period;
    },
    get detail() {
      return detail;
    },
    get hopeless() {
      return hopeless > 4 && !(typeof window !== "undefined" && window.__hold);
    },
    stats: () => {
      const now = performance.now(),
        d = log
          .filter((x) => x[0] > now - 5000)
          .map((x) => x[1])
          .sort((x, y) => x - y);
      return {
        fps: d.length ? 1000 / (d.reduce((x, y) => x + y, 0) / d.length) : 0,
        worst: d.at(-1) || 0,
        late: d.filter((x) => x > period * (half ? 2 : 1) * 1.5).length,
        n: d.length,
        gpu: world.gpu,
        q,
        half,
        detail,
        hz: 1000 / period,
        w: world.w,
      };
    },
    /** false when this refresh should be skipped to hold an even half rate */
    tick() {
      if (!half) return true;
      skip = !skip;
      return !skip;
    },
    frame(dt, now) {
      log.push([now, dt]);
      if (log.length > 900) log.splice(0, 400);
      dts.push(dt);
      sum += dt;
      if (dts.length < 24 && (sum < 900 || dts.length < 4)) return;
      const s = dts.sort((a, b) => a - b),
        at = (f) => s[Math.floor(s.length * f)],
        p25 = at(0.25),
        p50 = at(0.5),
        p75 = at(0.72);
      dts = [];
      sum = 0;
      if (!half && p25 < period * 0.72) {
        period = snap(p25);
        ref = null;
        capped = 0;
      } // the limit was lifted
      const step = period * (half ? 2 : 1),
        budget = Math.min(Math.max(step, 11), 16.7) * 0.62,
        gpu = world.gpu,
        over = p75 > step * 1.3,
        heavy = gpu ? gpu > budget * 1.1 : over;
      if (p75 > 90) {
        q = min;
        detail = 0.55;
        hopeless += 2;
        return;
      }
      if (now < hold) return;
      if (probe) {
        // one window at the smallest picture: faster means the picture was the cause, the same means it was not
        const faster = p50 < probe.p50 * 0.93;
        if (faster) {
          q = min + (probe.q - min) * 0.45;
          cap = q * 1.06;
          capAt = now;
        } else {
          q = Math.max(probe.from, start);
          cap = 1;
          hold = now + 6000;
          if (probe.limit) {
            period = 33.33;
            half = false;
          } else detail = 0.55;
        }
        probe = null;
        ref = null;
        good = 0;
        return;
      }
      if (over && !heavy) {
        // late, and the graphics card is not why
        if (p50 < 35.5 && p50 > period * 1.5 && p75 - p25 < 6) {
          if (++capped > 2) {
            period = 33.33;
            half = false;
            capped = 0;
            q = Math.max(q, start);
            cap = 1;
          }
        } else if (++capped > 3) detail = 0.55;
        return;
      }
      if (over && !gpu) {
        // no timer here: did a smaller picture help? If not, the picture is not the cause
        if (!ref) ref = { q, p50 };
        else if (q < ref.q * 0.8) {
          if (p50 > ref.p50 * 0.93) {
            probe = { q, from: ref.q, p50, limit: p50 < 35.5 && p50 > period * 1.5 && p75 - p25 < 6 };
            q = min;
            return;
          }
          ref = { q, p50 };
        }
      } else if (!over) {
        ref = null;
        capped = 0;
      }
      if (q <= min + 0.001 && p75 > Math.max(42, step * 1.3)) {
        detail = 0.55;
        hopeless++;
      } else hopeless = Math.max(0, hopeless - 2);
      if (heavy) {
        lower(gpu ? clamp(Math.sqrt(budget / gpu), 0.8, 0.96) : 0.9, now);
        if (q < 0.6 && period < 11 && !half) {
          half = true;
          q = 0.8;
          cap = 1;
          ref = null;
        }
      } else if (++good > (gpu ? 2 : 8) && (!gpu || gpu < budget * 0.72)) {
        if (now - capAt > wait && cap < 1) {
          cap = 1;
          wait = Math.min(wait * 2, 160000);
        }
        q = Math.max(q, Math.min(cap, q * 1.04));
        good = 0;
      }
    },
  };
}
