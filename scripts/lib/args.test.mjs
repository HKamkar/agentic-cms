import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, UsageError, usageText } from "./args.mjs";

const spec = {
  command: "shot",
  summary: "one screenshot of a page or an element",
  usage: "agentic-cms shot <route|url> [options]",
  positionals: [{ name: "target", required: true, help: "a route of the build (/about) or a URL" }],
  flags: {
    width: { type: "number", default: 1440, help: "viewport width in px" },
    motion: { type: "boolean", help: "play the animations instead of freezing them" },
    select: { type: "string", value: "<css>", help: "the element to photograph" },
    domain: { type: "string", multiple: true, value: "<host>", help: "a domain to scan for" },
    json: { type: "boolean", help: "print one JSON document on stdout" },
  },
  exit: { 0: "the shot was written", 2: "usage, no build, no browser" },
  json: "{ url, out, target: { box } }",
};

test("defaults, numbers, booleans and repeated flags", () => {
  const { positionals, flags } = parse(spec, ["/about", "--width", "390", "--motion", "--domain", "a.example", "--domain", "b.example"]);
  assert.deepEqual(positionals, ["/about"]);
  assert.equal(flags.width, 390);
  assert.equal(flags.motion, true);
  assert.equal(flags.json, false);
  assert.equal(flags.select, undefined);
  assert.deepEqual(flags.domain, ["a.example", "b.example"]);
  assert.equal(parse(spec, ["/"]).flags.width, 1440);
});

test("an unknown flag is a usage error that names the fix", () => {
  assert.throws(() => parse(spec, ["/", "--wide"]), (error) => error instanceof UsageError && /unknown flag --wide; run agentic-cms shot --help/.test(error.message));
});

test("a missing value, a bad number and a missing positional are usage errors", () => {
  assert.throws(() => parse(spec, ["/", "--select"]), (error) => error instanceof UsageError && /--select needs a value/.test(error.message));
  assert.throws(() => parse(spec, ["/", "--width", "wide"]), (error) => error instanceof UsageError && /--width must be a number, not wide/.test(error.message));
  assert.throws(() => parse(spec, []), (error) => error instanceof UsageError && /shot needs <target>/.test(error.message));
});

test("--help anywhere asks for the usage", () => {
  assert.equal(parse(spec, ["--help"]).help, true);
  assert.equal(parse(spec, ["/", "--width", "1", "--help"]).help, true);
  assert.equal(parse(spec, ["/"]).help, false);
});

test("the usage text carries every flag, its value, its default, the exit codes and the JSON shape", () => {
  const text = usageText(spec);
  assert.match(text, /agentic-cms shot <route\|url> \[options\]/);
  assert.match(text, /one screenshot of a page or an element/);
  assert.match(text, /--width <n>\s+viewport width in px \(default 1440\)/);
  assert.match(text, /--select <css>\s+the element to photograph/);
  assert.match(text, /--domain <host>\s+a domain to scan for \(repeatable\)/);
  assert.match(text, /--motion\s+play the animations/);
  assert.match(text, /exit 0 +the shot was written/);
  assert.match(text, /exit 2 +usage, no build, no browser/);
  assert.match(text, /--json prints \{ url, out, target: \{ box \} \}/);
});

test("subcommands: the first positional picks the spec", () => {
  const parent = { command: "visual-parity", summary: "the screenshot harness", subcommands: { capture: { ...spec, command: "visual-parity capture", usage: "agentic-cms visual-parity capture <label>" }, compare: { command: "visual-parity compare", summary: "diff two captures", usage: "agentic-cms visual-parity compare <before> <after>", positionals: [{ name: "before", required: true }, { name: "after", required: true }], flags: { json: { type: "boolean" } } } } };
  const parsed = parse(parent, ["compare", "a", "b", "--json"]);
  assert.equal(parsed.subcommand, "compare");
  assert.deepEqual(parsed.positionals, ["a", "b"]);
  assert.equal(parsed.flags.json, true);
  assert.throws(() => parse(parent, ["diff"]), (error) => error instanceof UsageError && /visual-parity has no subcommand diff \(capture, compare\)/.test(error.message));
  assert.throws(() => parse(parent, []), (error) => error instanceof UsageError && /visual-parity needs a subcommand \(capture, compare\)/.test(error.message));
  assert.equal(parse(parent, ["--help"]).help, true);
  assert.match(usageText(parent), /capture\s+one screenshot/);
  assert.match(usageText(parent), /compare\s+diff two captures/);
});

test("a variadic positional collects the rest", () => {
  const files = { command: "optimize-webp", summary: "x", usage: "x", positionals: [{ name: "files", variadic: true, required: true }], flags: { quality: { type: "number", default: 80 } } };
  assert.deepEqual(parse(files, ["a.webp", "b.webp", "--quality", "70"]).positionals, ["a.webp", "b.webp"]);
  assert.throws(() => parse(files, []), (error) => /optimize-webp needs <files\.\.\.>/.test(error.message));
});
