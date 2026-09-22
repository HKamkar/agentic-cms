// The encoders of `lab render`: a still (WebP lossless like the placeholders,
// PNG, or JPEG on the paper), an animated WebP joined from frames by sharp
// (no ffmpeg needed), and a WebM or MP4 through ffmpeg — a system build, or
// the one Playwright's cache holds, which reads JPEG only and writes VP8.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const LOSSY = { quality: 82, alphaQuality: 90 };

/** One PNG frame to --out by its extension; { bytes }. */
export async function encodeStill(png, out, { format, lossy = false, paper = "#ffffff" } = {}) {
  let image = sharp(png);
  if (format === "jpg") image = image.flatten({ background: paper }).jpeg({ quality: 80 });
  else if (format === "png") image = image.png();
  else image = image.webp(lossy ? LOSSY : { lossless: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { size } = await image.toFile(out);
  return { bytes: size };
}

/** PNG frames to one animated WebP that loops forever, `delay` ms per frame; { bytes }. */
export async function encodeAnimatedWebp(frames, out, { delay, lossy = false } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { size } = await sharp(frames, { join: { animated: true } }).webp({ ...(lossy ? LOSSY : { lossless: true }), delay, loop: 0 }).toFile(out);
  return { bytes: size };
}

/** The encoders an ffmpeg build offers (its `-encoders` list), as a Set. */
export function ffmpegEncoders(file) {
  const text = execFileSync(file, ["-hide_banner", "-encoders"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return new Set([...text.matchAll(/^ [A-Z.]{6} (\S+)/gm)].map((m) => m[1]));
}

// libvpx and libx264 need even dimensions; the pad filter makes them so.
const EVEN = "pad=ceil(iw/2)*2:ceil(ih/2)*2";

/** The ffmpeg arguments for frames on stdin: PNG into VP9 (alpha kept when asked) or H.264 with a system build, JPEG into VP8 with the bundled one. */
export function ffmpegArgs({ bundled, format, fps, alpha, out }) {
  const input = ["-y", "-f", "image2pipe", "-c:v", bundled ? "mjpeg" : "png", "-framerate", String(fps), "-i", "pipe:0", "-vf", EVEN];
  if (format === "mp4") return [...input, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", out];
  if (bundled) return [...input, "-c:v", "libvpx", "-pix_fmt", "yuv420p", "-b:v", "2M", "-crf", "10", "-deadline", "good", out];
  return [...input, "-c:v", "libvpx-vp9", "-pix_fmt", alpha ? "yuva420p" : "yuv420p", "-b:v", "0", "-crf", "30", "-auto-alt-ref", "0", out];
}

/** Which ffmpeg, and what it lacks for the format and the ground; throws naming the fix. */
export function checkFfmpeg(found, { format, alpha }) {
  if (!found) throw new Error(`no ffmpeg for a .${format}: install ffmpeg (with libvpx-vp9${format === "mp4" ? " and libx264" : ""}), or run \`pnpm exec playwright-core install ffmpeg\` for the small build that writes VP8 WebM on the paper`);
  const encoders = ffmpegEncoders(found.file);
  if (format === "mp4" && !encoders.has("libx264")) throw new Error(`${found.file} has no libx264: install an ffmpeg with it for a .mp4, or write a .webm`);
  if (format === "webm" && !encoders.has(found.bundled ? "libvpx" : "libvpx-vp9") && !encoders.has("libvpx")) throw new Error(`${found.file} has no libvpx: install an ffmpeg with libvpx-vp9`);
  if (format === "webm" && found.bundled && alpha) throw new Error("Playwright's bundled ffmpeg writes VP8 without an alpha channel: pass --background paper, or install ffmpeg with libvpx-vp9 for a transparent .webm");
  return { ...found, encoders };
}

/** PNG frames through ffmpeg to --out; the bundled build gets JPEG frames flattened on the paper. { bytes } */
export async function encodeVideo(frames, out, { ffmpeg, format, fps, alpha, paper = "#ffffff" } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const inputs = ffmpeg.bundled ? await Promise.all(frames.map((f) => sharp(f).flatten({ background: paper }).jpeg({ quality: 95 }).toBuffer())) : frames;
  const args = ffmpegArgs({ bundled: ffmpeg.bundled, format, fps, alpha: alpha && !ffmpeg.bundled, out });
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg.file, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`))));
    (async () => { for (const frame of inputs) if (!child.stdin.write(frame)) await new Promise((r) => child.stdin.once("drain", r)); child.stdin.end(); })().catch(reject);
  });
  return { bytes: fs.statSync(out).size };
}
