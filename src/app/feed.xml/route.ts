import { kit } from "@/kit";

// Rendered once at build time and served as a static asset.
export const dynamic = "force-static";

export function GET() {
  return kit.seo.feed();
}
