import type { NextConfig } from "next";
import { redirectsFor } from "agentic-cms/content";

// Extra hostnames (no scheme or port) allowed to load dev assets and HMR, e.g.
// the public IP of a dev VM. `next dev` otherwise only serves localhost and
// the hostname it was started with. Set in `.env.local`, comma-separated.
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // content/redirects.yaml, read when Next loads this file at build time:
  // an indexed URL that moved answers 308 to where it went (docs/redirects.md).
  redirects: async () => redirectsFor(),
  // Images are pre-sized files shipped with the repo; the optimizer is off
  // so no image service is needed wherever the site runs.
  images: { unoptimized: true },
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
};

export default nextConfig;
