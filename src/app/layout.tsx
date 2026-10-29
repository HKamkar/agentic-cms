import type { Viewport } from "next";
import { SiteLayout } from "@/components/ui/SiteLayout";
import { copyFor } from "@/config/site";
import { kit } from "@/kit";
import "./globals.css";

// The default language's root layout. A language of site.locales has its own, a copy of this one in src/app/<prefix>/ with LOCALE its tag (docs/locales.md).
const LOCALE = kit.locales.default.locale;

// The head every page starts from: the origin, the title template and the home page's title and description, Open Graph's name and locale, the feed (src/lib/seo/README.md).
export const metadata = kit.seo.rootMetadata(LOCALE);

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteLayout site={kit.locales.site(LOCALE)} words={copyFor(LOCALE)}>
      {children}
    </SiteLayout>
  );
}
