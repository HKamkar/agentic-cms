import type { Viewport } from "next";
import { SiteLayout } from "@/components/ui/SiteLayout";
import { copyFor, site } from "@/config/site";
import { kit } from "@/kit";
import "./globals.css";

// The head every page starts from: the origin, the title template and the home page's title and description, Open Graph's name and locale, the feed (src/lib/seo/README.md).
export const metadata = kit.seo.rootMetadata();

export const viewport: Viewport = { colorScheme: "light dark" };

// The default language's root layout; a language of site.locales has its own, in its folder (docs/locales.md).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteLayout site={kit.locales.site(site.locale)} words={copyFor(site.locale)}>
      {children}
    </SiteLayout>
  );
}
