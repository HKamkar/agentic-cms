import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeEmail, encodeEmail, isEmailToken, readableEmail } from "./email.ts";

test("a token round-trips and never contains the address or an @", () => {
  const token = encodeEmail("hello@acme.example");
  assert.notEqual(token, "hello@acme.example");
  assert.ok(!token.includes("@") && !token.includes("acme"));
  assert.equal(decodeEmail(token), "hello@acme.example");
  assert.ok(isEmailToken(token));
  assert.ok(!isEmailToken("hello@acme.example"));
  assert.ok(!isEmailToken(""));
});

test("the readable form spells the address for a page before hydration", () => {
  assert.equal(readableEmail("hello@acme.example"), "hello [at] acme [dot] example");
  assert.equal(readableEmail("team@mail.acme.co.uk"), "team [at] mail.acme.co [dot] uk");
});
