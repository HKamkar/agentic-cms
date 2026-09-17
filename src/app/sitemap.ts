import type { MetadataRoute } from "next";
import { kit } from "@/kit";

/** Every page file (its `updated` is the lastmod) and every published post. */
export default function sitemap(): MetadataRoute.Sitemap {
  return kit.seo.sitemap();
}
