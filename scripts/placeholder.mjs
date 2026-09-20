#!/usr/bin/env node
// Writes one wireframe placeholder image: a mid-grey field with a one-pixel
// border and a corner-to-corner cross, no text, so it needs no fonts and reads
// on a light and a dark page alike. The format follows the extension: .webp
// (lossless), .jpg (quality 80), .png, or .svg (the drawing itself).
//
//   node scripts/placeholder.mjs <out> <width> <height>
//
// The committed placeholders under public/images are this script's output;
// regenerate one by running it again with the same size.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";

const FIELD = "#8c8c8c";
const LINE = "#2b2b2b";

const [out, widthArg, heightArg] = parseOrExit(SPECS.placeholder, process.argv.slice(2)).positionals;
const width = Number(widthArg);
const height = Number(heightArg);
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
  console.error(`placeholder: width and height are whole pixels, not ${widthArg} ${heightArg}; run agentic-cms placeholder --help`);
  process.exit(2);
}

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="${FIELD}" stroke="${LINE}"/>`,
  `<line x1="0" y1="0" x2="${width}" y2="${height}" stroke="${LINE}"/>`,
  `<line x1="${width}" y1="0" x2="0" y2="${height}" stroke="${LINE}"/>`,
  `</svg>`,
].join("");

const encoders = {
  ".svg": () => Buffer.from(svg),
  ".webp": () => sharp(Buffer.from(svg)).webp({ lossless: true }).toBuffer(),
  ".jpg": () => sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer(),
  ".jpeg": () => sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer(),
  ".png": () => sharp(Buffer.from(svg)).png().toBuffer(),
};

const encode = encoders[path.extname(out).toLowerCase()];
if (!encode) {
  console.error(`placeholder: unsupported extension ${path.extname(out)} (use .webp, .jpg, .png or .svg)`);
  process.exit(2);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const bytes = await encode();
fs.writeFileSync(out, bytes);
console.log(`${path.relative(process.cwd(), out)}  ${width}x${height}  ${(bytes.length / 1024).toFixed(1)}KB`);
