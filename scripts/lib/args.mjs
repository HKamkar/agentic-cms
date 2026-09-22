// One argument parser for every command, driven by a spec (scripts/lib/specs.mjs
// holds them all): strict, so an unknown flag is an error that names the fix
// rather than a silently ignored typo; `--help` anywhere asks for the usage,
// which is generated from the same spec, so the help, the docs
// (tools/commands-doc.mjs) and the parser cannot disagree. A spec:
//
//   { command, group, summary, usage, positionals: [{ name, required, variadic, help }],
//     flags: { name: { type: "number" | "string" | "boolean", default, multiple, value, choices, help } },
//     exit: { 0: "…", 1: "…", 2: "…" }, json: "the shape --json prints",
//     examples: ["agentic-cms … "], site: true,    // site: true — reads the site's registry (src/kit.ts); refused elsewhere
//     subcommands: { name: spec } }                // the first positional picks one
//
// Every wrong input answers with the right one: an unknown command, subcommand
// or flag names the nearest one ("did you mean"), a value outside `choices`
// lists them, a stray argument after a repeatable flag says how to repeat it.
// Exit codes are the kit's convention: 0 clean, 1 findings or differences, 2
// usage or environment. `parseOrExit()` is the call a script makes.
import { parseArgs } from "node:util";

export class UsageError extends Error {}

const helpFor = (spec) => `run agentic-cms ${spec.command} --help`;
const listOf = (spec) => Object.keys(spec.subcommands).join(", ");

// The edit distance of two short words, for "did you mean".
function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return rows[a.length][b.length];
}

/** The option nearest to a wrong word — a prefix, a superstring, or within three edits — as " — did you mean x?"; "" when none is close. */
export function suggest(word, options) {
  const w = word.toLowerCase();
  const scored = options.map((o) => ({ o, d: o.startsWith(w) || w.startsWith(o) || (w.length > 3 && o.includes(w)) ? 0 : distance(w, o.toLowerCase()) })).filter(({ o, d }) => d <= Math.min(3, Math.floor(o.length / 2))).sort((x, y) => x.d - y.d);
  return scored.length ? ` — did you mean ${scored[0].o}?` : "";
}

/** What a flag takes, for the help and the docs: its `value`, else its choices joined by |, else <n>. */
export const flagValue = (flag) => flag.value ?? (flag.choices ? flag.choices.join("|") : "<n>");

/** Parses argv against the spec: { positionals, flags, help, subcommand }; throws UsageError. */
export function parse(spec, argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { positionals: [], flags: {}, help: true, subcommand: spec.subcommands ? argv.find((a) => !a.startsWith("-")) : undefined };
  if (spec.subcommands) {
    const [name, ...rest] = argv;
    if (!name) throw new UsageError(`${spec.command} needs a subcommand (${listOf(spec)}); ${helpFor(spec)}`);
    if (!spec.subcommands[name]) throw new UsageError(`${spec.command} has no subcommand ${name}${suggest(name, Object.keys(spec.subcommands))} (${listOf(spec)}); ${helpFor(spec)}`);
    return { ...parse(spec.subcommands[name], rest), subcommand: name };
  }
  const options = Object.fromEntries(Object.entries(spec.flags ?? {}).map(([name, flag]) => [name, { type: flag.type === "boolean" ? "boolean" : "string", multiple: Boolean(flag.multiple) }]));
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, options, strict: true, allowPositionals: true }));
  } catch (error) {
    if (error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") { const wrong = error.message.match(/'([^']+)'/)[1]; throw new UsageError(`unknown flag ${wrong}${suggest(wrong.replace(/^-+/, "").replace(/=.*$/, ""), Object.keys(spec.flags ?? {})).replace("did you mean ", "did you mean --")}; ${helpFor(spec)}`); }
    if (error.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") throw new UsageError(`${error.message.match(/'(--[^ ']+)/)[1]} needs a value; ${helpFor(spec)}`);
    throw new UsageError(`${error.message}; ${helpFor(spec)}`);
  }
  const flags = {};
  for (const [name, flag] of Object.entries(spec.flags ?? {})) {
    const raw = values[name];
    if (raw === undefined) { flags[name] = flag.type === "boolean" ? false : flag.multiple ? (flag.default ?? []) : flag.default; continue; }
    if (flag.type === "number") {
      const numbers = (flag.multiple ? raw : [raw]).map((v) => { const n = Number(v); if (v.trim() === "" || Number.isNaN(n)) throw new UsageError(`--${name} must be a number, not ${v}; ${helpFor(spec)}`); return n; });
      flags[name] = flag.multiple ? numbers : numbers[0];
    } else flags[name] = raw;
    if (flag.choices) for (const v of flag.multiple ? flags[name] : [flags[name]]) if (!flag.choices.includes(v)) throw new UsageError(`--${name} is one of ${flag.choices.join(", ")}, not ${v}; ${helpFor(spec)}`);
  }
  const wanted = spec.positionals ?? [];
  const fixed = wanted.filter((p) => !p.variadic);
  const variadic = wanted.find((p) => p.variadic);
  const missing = wanted.find((p, i) => p.required && (p.variadic ? positionals.length <= fixed.length : positionals[i] === undefined));
  if (missing) throw new UsageError(`${spec.command} needs <${missing.name}${missing.variadic ? "..." : ""}>; ${helpFor(spec)}`);
  if (!variadic && positionals.length > fixed.length) {
    // The usual cause: two values after a repeatable flag, which takes one each time.
    const repeated = Object.keys(spec.flags ?? {}).find((n) => spec.flags[n].multiple && argv.includes(`--${n}`));
    const hint = repeated ? ` — --${repeated} takes one value each time: --${repeated} a --${repeated} b` : "";
    throw new UsageError(`${spec.command} takes ${fixed.length} argument${fixed.length === 1 ? "" : "s"}, not ${positionals.length} (${positionals.slice(fixed.length).map((p) => `"${p}"`).join(", ")} is extra)${hint}; ${helpFor(spec)}`);
  }
  return { positionals, flags, help: false, subcommand: undefined };
}

const flagLine = (name, flag) => {
  const head = `--${name}${flag.type === "boolean" ? "" : ` ${flagValue(flag)}`}`;
  const tail = [flag.help, flag.default !== undefined && `(default ${flag.default})`, flag.multiple && "(repeatable)"].filter(Boolean).join(" ");
  return `  ${head.padEnd(24)} ${tail}`.trimEnd();
};

/** The help text of a spec (or of a subcommand family), from the spec alone. */
export function usageText(spec) {
  const lines = [`${spec.usage ?? spec.command}`, `  ${spec.summary}`, ""];
  if (spec.subcommands) {
    lines.push("subcommands:", ...Object.entries(spec.subcommands).map(([name, sub]) => `  ${name.padEnd(24)} ${sub.summary}`), "", `agentic-cms ${spec.command} <subcommand> --help for its flags`);
    return lines.join("\n");
  }
  for (const p of spec.positionals ?? []) if (p.help) lines.push(`  <${p.name}${p.variadic ? "..." : ""}>${" ".repeat(Math.max(1, 21 - p.name.length))} ${p.help}`);
  if (spec.flags && Object.keys(spec.flags).length) lines.push("flags:", ...Object.entries(spec.flags).map(([name, flag]) => flagLine(name, flag)));
  if (spec.exit) lines.push("", ...Object.entries(spec.exit).map(([code, what]) => `  exit ${code}  ${what}`));
  if (spec.json) lines.push("", `  --json prints ${spec.json}`);
  if (spec.examples?.length) lines.push("", "examples:", ...spec.examples.map((e) => `  ${e}`));
  return lines.join("\n");
}

/** Parses for a script: on --help prints the usage and exits 0; on a usage error prints it and exits 2; else returns the parse. */
export function parseOrExit(spec, argv) {
  let parsed;
  try { parsed = parse(spec, argv); } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`${spec.command}: ${error.message}`);
    process.exit(2);
  }
  if (parsed.help) { console.log(usageText(parsed.subcommand && spec.subcommands?.[parsed.subcommand] ? spec.subcommands[parsed.subcommand] : spec)); process.exit(0); }
  return parsed;
}
