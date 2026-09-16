import { Container } from "./Container";
import { NavLink } from "./NavLink";
import { site } from "@/config/site";

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

/** The site footer: who this is, where to write, and the two link columns, in one box. */
export function Footer() {
  return (
    <footer className="py-section">
      <Container>
        <div className="grid gap-6 border border-ink p-6 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-2">
            <NavLink href="/" label={site.shortName} className="self-start font-semibold no-underline" />
            <p>{site.tagline}</p>
            <address className="not-italic">
              {site.address.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </address>
            <a href={`mailto:${site.email}`} className="self-start">
              {site.email}
            </a>
          </div>
          <LinkColumn title="Quick links" links={site.footer.quickLinks} />
          <LinkColumn title="Follow us" links={site.footer.social} />
          <p className="text-muted lg:col-span-3">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </Container>
    </footer>
  );
}
