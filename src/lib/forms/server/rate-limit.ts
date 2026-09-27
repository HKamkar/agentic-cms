// How often one visitor may send one form. The default limiter lives in the
// server's memory: it counts per instance (per isolate on Workers, which come
// and go), so it slows a script down rather than enforcing a quota. A site
// that needs a hard limit passes its own RateLimiter over a shared store.

/** Decides whether one more submission under a key (a form and an address) is allowed now. */
export interface RateLimiter {
  allow(key: string): boolean;
}

export type MemoryRateLimiterOptions = {
  /** Submissions allowed per key and window. */
  limit?: number;
  windowMs?: number;
  /** Keys held at most; the oldest window goes first. Keys come from requests, so the map is bounded. */
  maxKeys?: number;
  now?: () => number;
};

/** A fixed window per key, in a Map whose insertion order is the windows' age. */
export function memoryRateLimiter({ limit = 5, windowMs = 10 * 60_000, maxKeys = 10_000, now = Date.now }: MemoryRateLimiterOptions = {}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key) {
      const time = now();
      const current = windows.get(key);
      if (current && time - current.start < windowMs) {
        current.count += 1;
        return current.count <= limit;
      }
      windows.delete(key);
      if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
      windows.set(key, { start: time, count: 1 });
      return true;
    },
  };
}

/**
 * The visitor's address as the nearest proxy saw it: the rightmost
 * X-Forwarded-For hop. Proxies append, so the hops to its left came from the
 * client and can say anything; App Service's front end and Cloudflare both
 * add the real address last. A site behind a further proxy of its own passes
 * its own reader to createFormHandler. A port (App Service adds one) is
 * stripped.
 */
export function clientIp(request: Request): string {
  const hops = (request.headers.get("x-forwarded-for") ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  return withoutPort(hops.at(-1) ?? "") || "unknown";
}

function withoutPort(hop: string): string {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(hop);
  if (bracketed) return bracketed[1];
  // An IPv4 address with a port has one colon; a bare IPv6 address has several.
  const parts = hop.split(":");
  return parts.length === 2 ? parts[0] : hop;
}
