import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` see Cloudflare bindings (none are used yet; harmless to keep).
initOpenNextCloudflareForDev();

// Extra hostnames (no scheme or port) allowed to load dev assets and HMR, e.g.
// the public IP of a dev VM. `next dev` otherwise only serves localhost and
// the hostname it was started with. Set in `.env.local`, comma-separated.
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Images are pre-sized files shipped with the repo; skip the optimizer so
  // the Worker needs no Cloudflare Images binding. Flip this off (and enable the
  // "images" binding in wrangler.jsonc) if you want on-the-fly resizing.
  images: { unoptimized: true },
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
};

export default nextConfig;
