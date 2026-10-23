import type { Viewport } from "next";
import { GoogleTag, consentDefaultScript } from "agentic-cms/consent/google";
import { ConsentBanner } from "@/components/ui/ConsentBanner";
import { Footer } from "@/components/ui/Footer";
import { Navbar } from "@/components/ui/Navbar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { analytics } from "@/config/analytics";
import { chrome, consentBanner, site } from "@/config/site";
import { kit } from "@/kit";
import "./globals.css";

// The stored theme has to be on <html> before the first paint, or a reader who
// chose dark sees a white page flash first. Small enough to inline, and it
// runs before hydration — hence suppressHydrationWarning on <html>.
const THEME_SCRIPT = "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";

// The head every page starts from: the origin, the title template and the home page's title and description, Open Graph's name and locale, the feed (src/lib/seo/README.md).
export const metadata = kit.seo.rootMetadata();

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.locale} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Google's consent default, every type denied, before anything of Google's can run: an inline script here runs as the page is parsed, before hydration (docs/consent.md). Only with a tag id (src/config/analytics.ts). */}
        {analytics.tagId && <script id="consent-default" dangerouslySetInnerHTML={{ __html: consentDefaultScript(analytics.consent) }} />}
        {/* Keyboard skip link: invisible until focused */}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:border focus:border-line focus:bg-panel focus:px-3 focus:py-2">
          {chrome.skipLink}
        </a>
        {/* The chrome's client components get what they show as props: none imports site.ts, which would ship all of it, the address included, in a bundle (docs/email.md). */}
        {analytics.tagId && <ConsentBanner copy={consentBanner} />}
        <Navbar brand={site.shortName} links={site.nav} signIn={site.signIn} cta={site.cta} copy={chrome.navbar}>
          <ThemeToggle labels={chrome.themeToggle} />
        </Navbar>
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
