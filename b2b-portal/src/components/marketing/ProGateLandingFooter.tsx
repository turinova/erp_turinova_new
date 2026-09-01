import Link from "next/link";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";
import { appAuthHref, appPathHref } from "@/lib/hosts";
import { PROGATE_VERTICALS } from "@/lib/marketing/verticals";

const FOOTER_NAV = [
  { href: "#hogyan", label: "Hogyan" },
  { href: "#demo", label: "Demó" },
  { href: "#csomag", label: "Csomagok" },
  { href: "#gyik", label: "GYIK" },
  { href: "/kiknek", label: "Kiknek?", route: true },
  { href: appAuthHref("/signup"), label: "Próba", route: true },
  { href: appAuthHref("/login"), label: "Belépés", route: true },
  { href: appPathHref("/tudasbazis"), label: "Segítség", route: true },
] as const;

const YEAR = new Date().getFullYear();

export function ProGateLandingFooter() {
  return (
    <footer className="pg-footer">
      <div className="pg-footer-inner">
        <div className="pg-footer-row">
          <a href="#top" className="pg-footer-logo" aria-label="ProGate főoldal">
            <TurinovaWordmark height={28} />
          </a>
          <nav className="pg-footer-nav" aria-label="Lábléc navigáció">
            {FOOTER_NAV.map((item) =>
              "route" in item && item.route ? (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ),
            )}
            <a href={`mailto:${COMPANY.emails.support}`}>{COMPANY.emails.support}</a>
          </nav>
        </div>

        <nav className="pg-footer-verticals" aria-label="Iparágak">
          <span className="pg-footer-v-label">Kiknek?</span>
          {PROGATE_VERTICALS.map((v) => (
            <Link key={v.slug} href={`/kiknek/${v.slug}`}>
              {v.footerLabel}
            </Link>
          ))}
        </nav>

        <div className="pg-footer-signoff">
          <p className="pg-footer-copy">
            © {YEAR} {COMPANY.shortName} · {COMPANY.brand}
          </p>
          <p className="pg-footer-legal">
            {LEGAL_LINKS.map((l, i) => (
              <span key={l.href}>
                {i > 0 ? <span className="pg-footer-sep"> · </span> : null}
                <Link href={l.href}>{l.label}</Link>
              </span>
            ))}
            <span className="pg-footer-sep"> · </span>
            <a href={COMPANY.website} target="_blank" rel="noopener noreferrer">
              {COMPANY.websiteHost}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
