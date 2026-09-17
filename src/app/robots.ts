import type { MetadataRoute } from "next";
import { kit } from "@/kit";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: kit.urls.absoluteUrl("/sitemap.xml"),
  };
}
