#!/usr/bin/env node
// Re-encodes the PNGs that design-tool SVG exports embed as base64 data URIs
// into WebP, in place. The SVG itself (masks, patterns, gradients, opacities)
// is untouched, so it renders exactly as before; only the bytes shrink.
//
//   node scripts/optimize-svg-rasters.mjs [--lossy] [--dry-run] [file.svg ...]
//
// Without files, every SVG under public/images that embeds a PNG (or an
// earlier WebP, so a lossless pass can be followed by a --lossy one).
// Lossless WebP is always pixel-identical. --lossy also allows quality-80 WebP
// with exact alpha where that is smaller: only for images the SVG uses as an
// alpha mask (mask-type:alpha), where the colour channels never show.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";

const DIR = "public/images";
const DATA_URI = /data:image\/(?:png|webp);base64,([A-Za-z0-9+/=]+)/g;
const { positionals: files, flags } = parseOrExit(SPECS["optimize-svg-rasters"], process.argv.slice(2));
const { lossy, "dry-run": dryRun } = flags;

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function encode(png) {
  const lossless = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
  if (!lossy) return { buf: lossless, mode: "lossless" };
  const q80 = await sharp(png).webp({ quality: 80, alphaQuality: 100, effort: 6 }).toBuffer();
  return q80.length < lossless.length ? { buf: q80, mode: "q80" } : { buf: lossless, mode: "lossless" };
}

async function optimize(file) {
  const svg = fs.readFileSync(file, "utf8");
  const matches = [...svg.matchAll(DATA_URI)];
  if (matches.length === 0) return;
  let out = svg;
  const modes = [];
  for (const m of matches) {
    const { buf, mode } = await encode(Buffer.from(m[1], "base64"));
    out = out.replace(m[0], `data:image/webp;base64,${buf.toString("base64")}`);
    modes.push(mode);
  }
  const saved = svg.length - out.length;
  console.log(`${path.basename(file).padEnd(60)} ${kb(svg.length).padStart(7)} -> ${kb(out.length).padStart(6)}  (${modes.join(", ")})${saved <= 0 ? "  kept" : ""}`);
  if (!dryRun && saved > 0) fs.writeFileSync(file, out);
}

for (const file of files) if (!fs.existsSync(file)) { console.error(`optimize-svg-rasters: ${file}: no such file`); process.exit(2); }
const targets = files.length ? files : fs.readdirSync(DIR, { recursive: true }).filter((f) => f.endsWith(".svg")).map((f) => path.join(DIR, f));
for (const file of targets) await optimize(file);
