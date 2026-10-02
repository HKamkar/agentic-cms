import type { Metadata, Viewport } from "next";
import { GoogleTag, consentDefaultScript } from "agentic-cms/consent/google";
import { ConsentBanner } from "@/components/ui/ConsentBanner";
import { Footer } from "@/components/ui/Footer";
import { Navbar } from "@/components/ui/Navbar";
import { analytics } from "@/config/analytics";
import { site } from "@/config/site";
import { kit } from "@/kit";
import "./globals.css";

// The stored theme has to be on <html> before the first paint, or a reader who
// chose dark sees a white page flash first. Small enough to inline, and it
// runs before hydration — hence suppressHydrationWarning on <html>.
const THEME_SCRIPT = "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";

const home = () => kit.content.getPage("home");

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: home().seo.title, template: `%s | ${site.name}` },
  description: home().seo.description,
  openGraph: { type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": `${site.url}/feed.xml` } },
};

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.locale} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Google's consent default, every type denied, before anything of Google's can run: an inline script here runs as the page is parsed, before hydration (docs/consent.md). Only with a tag id (src/config/analytics.ts). */}
        {analytics.tagId && <script id="consent-default" dangerouslySetInnerHTML={{ __html: consentDefaultScript(analytics.consent) }} />}
        {/* Keyboard skip link: invisible until focused */}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2">
          Skip to content
        </a>
        {analytics.tagId && <ConsentBanner />}
        <Navbar />
        {/* The one outline-none on the site: <main> is focused by the skip link, not reached by tabbing. */}
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        {/* The tag itself, loaded only as the visitor's choice allows (basic mode: nothing before a grant). */}
        {analytics.tagId && <GoogleTag tagId={analytics.tagId} policy={analytics.consent} />}
      </body>
    </html>
  );
}
