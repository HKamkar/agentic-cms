import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, memoryRateLimiter } from "./rate-limit.ts";

test("allows the limit per window and key, then refuses until the window passes", () => {
  let now = 0;
  const limiter = memoryRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.deepEqual([limiter.allow("a"), limiter.allow("a"), limiter.allow("a"), limiter.allow("b")], [true, true, false, true]);
  now = 1000;
  assert.equal(limiter.allow("a"), true);
});

test("holds at most maxKeys, forgetting the oldest window first", () => {
  let now = 0;
  const limiter = memoryRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => now });
  limiter.allow("a");
  now = 1;
  limiter.allow("b");
  limiter.allow("c");
  assert.equal(limiter.allow("b"), false, "b is still counted");
  assert.equal(limiter.allow("a"), true, "a was evicted, so it starts again");
});

const from = (forwardedFor?: string) => new Request("https://site.example/api/forms/contact", { headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor } });

test("clientIp reads the rightmost X-Forwarded-For hop, the one the proxy added", () => {
  assert.equal(clientIp(from("198.51.100.1, 203.0.113.7")), "203.0.113.7");
  assert.equal(clientIp(from("203.0.113.7:51234")), "203.0.113.7");
  assert.equal(clientIp(from("[2001:db8::1]:443")), "2001:db8::1");
  assert.equal(clientIp(from("2001:db8::1")), "2001:db8::1");
  assert.equal(clientIp(from()), "unknown");
});
