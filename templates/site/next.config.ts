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
  // Next 16.4 can ask the npm registry about advisories during a build, and an
  // agent's first build that finds one fails with instructions for the agent.
  // A build fetches nothing here; the alerts are GitHub's
  // (node_modules/agentic-cms/docs/gotchas.md).
  experimental: { agentUpgrade: false },
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
};

export default nextConfig;
