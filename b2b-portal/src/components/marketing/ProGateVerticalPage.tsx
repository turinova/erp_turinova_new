import "@/app/globals-landing.css";
import Link from "next/link";
import { ProGateLandingFooter } from "@/components/marketing/ProGateLandingFooter";
import { ProGateLandingNav } from "@/components/marketing/ProGateLandingNav";
import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import { COMPANY } from "@/lib/company";
import { appAuthHref } from "@/lib/hosts";
import type { ProGateVertical } from "@/lib/marketing/verticals";
import { PROGATE_VERTICALS } from "@/lib/marketing/verticals";

type Props = {
  vertical: ProGateVertical;
};

export function ProGateVerticalPage({ vertical }: Props) {
  const related = PROGATE_VERTICALS.filter((v) => v.slug !== vertical.slug).slice(
    0,
    5,
  );

  return (
    <div className="pg">
      <ProGateLandingNav />

      <main className="pg-vertical">
        <div className="pg-vertical-inner">
          <nav className="pg-vertical-crumb" aria-label="Vissza">
            <Link href="/">ProGate</Link>
            <span aria-hidden> / </span>
            <Link href="/kiknek">Kiknek?</Link>
            <span aria-hidden> / </span>
            <span>{vertical.footerLabel}</span>
          </nav>

          <article>
            <p className="pg-kicker">Shoprenter nagyker</p>
            <h1 className="pg-vertical-h1">{vertical.h1}</h1>
            <p className="pg-lead pg-vertical-lead">{vertical.intro}</p>

            <h2 className="pg-vertical-h2">Ismerős?</h2>
            <ul className="pg-vertical-pains">
              {vertical.pains.map((pain) => (
                <li key={pain}>{pain}</li>
              ))}
            </ul>

            <p className="pg-vertical-closing">{vertical.closing}</p>

            <div className="pg-vertical-cta">
              <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
                {TRIAL_DAYS_DEFAULT} nap próba →
              </Link>
              <Link href="/#demo" className="pg-btn pg-btn-ghost">
                Demó a főoldalon
              </Link>
            </div>
          </article>

          <aside className="pg-vertical-aside">
            <p className="pg-footer-label">Más iparág</p>
            <ul className="pg-vertical-related">
              {related.map((v) => (
                <li key={v.slug}>
                  <Link href={`/kiknek/${v.slug}`}>{v.footerLabel}</Link>
                </li>
              ))}
            </ul>
            <p className="pg-footer-muted pg-vertical-aside-note">
              Kérdés?{" "}
              <a href={`mailto:${COMPANY.emails.support}`}>
                {COMPANY.emails.support}
              </a>
            </p>
          </aside>
        </div>
      </main>

      <ProGateLandingFooter />
    </div>
  );
}
