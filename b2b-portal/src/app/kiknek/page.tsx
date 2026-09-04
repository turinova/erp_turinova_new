import type { Metadata } from "next";
import Link from "next/link";
import "@/app/globals-landing.css";
import { ProGateComingSoon } from "@/components/marketing/ProGateComingSoon";
import { ProGateLandingFooter } from "@/components/marketing/ProGateLandingFooter";
import { ProGateLandingNav } from "@/components/marketing/ProGateLandingNav";
import { COMPANY } from "@/lib/company";
import { isProGateLandingComingSoon } from "@/lib/landing-mode";
import { PROGATE_VERTICALS } from "@/lib/marketing/verticals";

export async function generateMetadata(): Promise<Metadata> {
  if (isProGateLandingComingSoon()) {
    return {
      title: { absolute: `${COMPANY.brand} — Hamarosan` },
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `Kiknek? — B2B gyors rendelés iparágak szerint | ${COMPANY.brand}`,
    description:
      "ProGate Shoprenter nagyker és viszonteladó iparágak: autóalkatrész, állateledel, bútorlap, építőanyag és további szektorok.",
    robots: { index: true, follow: true },
  };
}

export default function KiknekIndexPage() {
  if (isProGateLandingComingSoon()) {
    return <ProGateComingSoon />;
  }

  return (
    <div className="pg">
      <ProGateLandingNav />

      <main className="pg-vertical pg-vertical--index">
        <div className="pg-vertical-inner pg-vertical-inner--index">
          <p className="pg-kicker">Shoprenter nagyker</p>
          <h1 className="pg-vertical-h1">Kiknek való a ProGate?</h1>
          <p className="pg-lead pg-vertical-lead">
            Nagyker és viszonteladó webshopok, ahol a partner listában rendel —
            nem kategóriákat böngész. Válaszd ki a szektorod, olvasd el a
            konkrét helyzetet, indítsd a próbát.
          </p>

          <ul className="pg-kiknek-index">
            {PROGATE_VERTICALS.map((v) => (
              <li key={v.slug}>
                <Link href={`/kiknek/${v.slug}`} className="pg-kiknek-index-link">
                  <span className="pg-kiknek-index-title">{v.footerLabel}</span>
                  <span className="pg-kiknek-index-desc">{v.pains[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <ProGateLandingFooter />
    </div>
  );
}
