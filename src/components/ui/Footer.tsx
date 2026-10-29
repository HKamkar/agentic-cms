import type { SiteConfig } from "agentic-cms";
import { EmailLink } from "agentic-cms/components";
import { encodeEmail } from "agentic-cms/email";
import { Container } from "./Container";
import { CookieSettingsButton } from "./CookieSettingsButton";
import { NavLink } from "./NavLink";
import { Panel } from "./Panel";
import { analytics } from "@/config/analytics";

const columnTitle = "font-label uppercase";

function LinkColumn({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={columnTitle}>{title}</p>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.label}>
            <NavLink href={link.href} label={link.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type FooterProps = {
  /** The site's config in the page's language (kit.locales.site()): the brand, the tagline, the address, the e-mail, the link columns. */
  site: SiteConfig;
  /** The columns' titles, chrome.footer in the page's language. */
  titles: { quickLinks: string; social: string };
  /** Cookie settings' label, consentBanner.settings in the page's language. */
  settings: string;
};

/** The site footer: who this is, where to write, the two link columns and, when a tag asks for consent, Cookie settings, in one panel. */
export function Footer({ site, titles, settings }: FooterProps) {
  return (
    <footer className="py-section">
      <Container>
        <Panel className="grid gap-6 p-6 lg:grid-cols-2-1-1">
          <div className="flex flex-col gap-2">
            <NavLink href={site.links.home} label={site.shortName} className="self-start font-semibold no-underline" />
            <p>{site.tagline}</p>
            <address className="not-italic">
              {site.address.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </address>
            {site.email && <EmailLink token={encodeEmail(site.email)} className="self-start" />}
          </div>
          <LinkColumn title={titles.quickLinks} links={site.footer.quickLinks} />
          <LinkColumn title={titles.social} links={site.footer.social} />
          <p className="text-muted lg:col-span-3">
            © {new Date().getFullYear()} {site.name}
          </p>
          {analytics.tagId && <CookieSettingsButton label={settings} className="justify-self-start underline lg:col-span-3" />}
        </Panel>
      </Container>
    </footer>
  );
}
