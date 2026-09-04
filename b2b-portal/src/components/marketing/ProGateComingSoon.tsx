import "@/app/globals-landing.css";
import { ProGateWordmark } from "@/components/brand/TurinovaWordmark";
import { COMPANY } from "@/lib/company";

/**
 * Brand-first „Hamarosan” placeholder — marketing only.
 * Logo dominates; one headline, one line, contact.
 */
export function ProGateComingSoon() {
  const mail = COMPANY.emails.central;
  const phone = COMPANY.phones.primaryDisplay;
  const phoneHref = `tel:${phone.replace(/\s+/g, "")}`;

  return (
    <div className="pg pg-soon">
      <div className="pg-soon-atmosphere" aria-hidden />
      <main className="pg-soon-main">
        <div className="pg-soon-brand">
          <ProGateWordmark height={64} className="pg-soon-logo" />
        </div>
        <h1 className="pg-soon-title">Hamarosan</h1>
        <p className="pg-soon-lead">
          A ProGate weboldal hamarosan elérhető. Addig keress bátran.
        </p>
        <p className="pg-soon-contact">
          <a href={`mailto:${mail}`}>{mail}</a>
          <span className="pg-soon-sep" aria-hidden>
            ·
          </span>
          <a href={phoneHref}>{phone}</a>
        </p>
      </main>
      <footer className="pg-soon-foot">
        <span>
          {COMPANY.parentBrand} · {COMPANY.address.full}
        </span>
      </footer>
    </div>
  );
}
