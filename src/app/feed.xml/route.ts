import { kit } from "@/kit";

// The default language's feed. A language of site.locales with posts has its own copy of this file in src/app/<prefix>/feed.xml/, with LOCALE its tag (docs/locales.md).
const LOCALE = kit.locales.default.locale;

// Rendered once at build time and served as a static asset.
export const dynamic = "force-static";

export function GET() {
  return kit.seo.feed(LOCALE);
}
