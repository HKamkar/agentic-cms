#!/usr/bin/env node
// Re-encodes WebP files as lossy WebP, in place, when that saves enough.
// Design-tool exports are usually lossless: 3-5x the bytes of a
// visually identical quality-80 encode.
//
//   node scripts/optimize-webp.mjs [--quality 80] [--max-width N] [--min-saving 30] [--dry-run] <file-or-dir ...>
//
// Directories are walked. Alpha is kept at full quality. --max-width also
// downscales pictures wider than N pixels (aspect ratio kept).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : Number(args[i + 1]); };
const quality = opt("--quality", 80);
const maxWidth = opt("--max-width", 0);
const minSaving = opt("--min-saving", 30);
const dryRun = args.includes("--dry-run");
const targets = args.filter((a, i) => !a.startsWith("--") && !["--quality", "--max-width", "--min-saving"].includes(args[i - 1]));

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const walk = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((f) => walk(path.join(p, f))) : p.endsWith(".webp") ? [p] : []);

async function optimize(file) {
  const before = fs.readFileSync(file);
  const meta = await sharp(before).metadata();
  let image = sharp(before);
  const resized = maxWidth && meta.width > maxWidth;
  if (resized) image = image.resize({ width: maxWidth });
  const after = await image.webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer();
  const saving = 100 * (1 - after.length / before.length);
  const keep = saving < minSaving;
  console.log(`${path.relative(process.cwd(), file).padEnd(96)} ${kb(before.length).padStart(6)} -> ${kb(after.length).padStart(6)}  ${meta.width}x${meta.height}${resized ? ` -> ${maxWidth}w` : ""}${keep ? "  kept" : ""}`);
  if (!dryRun && !keep) fs.writeFileSync(file, after);
}

for (const file of targets.flatMap(walk)) await optimize(file);
