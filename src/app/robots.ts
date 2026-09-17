import type { MetadataRoute } from "next";
import { kit } from "@/kit";

export default function robots(): MetadataRoute.Robots {
  return kit.seo.robots();
}
