import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// The blog is fully prerendered at build time. The static-assets cache serves
// those prerendered pages straight from Workers Static Assets, so the Worker
// never renders a page (or touches the filesystem) at request time and needs
// no R2/KV bucket. `opennextjs-cloudflare preview|deploy|upload` populate it.
//
// If you later add ISR (`revalidate`) or on-demand revalidation, switch to the
// R2 incremental cache: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
