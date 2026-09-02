import "@/app/globals-landing.css";
import Link from "next/link";
import { ProGateHeroBenefits } from "@/components/marketing/ProGateHeroBenefits";
import { ProGateHeroMocks } from "@/components/marketing/ProGateHeroMocks";
import { ProGateLandingFooter } from "@/components/marketing/ProGateLandingFooter";
import { ProGateLandingNav } from "@/components/marketing/ProGateLandingNav";
import { ProGateLossCalc } from "@/components/marketing/ProGateLossCalc";
import {
  BASE_PRICE_HUF,
  MARK_ADDON_HUF,
  TRIAL_DAYS_DEFAULT,
  WHITE_LABEL_PRICE_HUF,
  formatPlanPrice,
} from "@/lib/billing/plans";
import { COMPANY } from "@/lib/company";
import { appAuthHref } from "@/lib/hosts";
import { getFeaturedVerticals, PROGATE_VERTICALS } from "@/lib/marketing/verticals";

const DEMO_MAIL = `mailto:${COMPANY.emails.support}?subject=${encodeURIComponent("ProGate demo")}`;

/** FOMO one-pager — hero + trust + proof + decision. */

const TRUST_BADGES = [
  "Shoprenter-natív",
  `${TRIAL_DAYS_DEFAULT} nap · kártya nélkül`,
  "Pár óra alatt élő",
  "Magyar support",
] as const;

const LOSS_LINES = [
  {
    strong: "Órák",
    rest: " — kézi rendelésfelvétel minden hónapban.",
  },
  {
    strong: "Partner",
    rest: " — vár az e-mailre, közben máshol is rendel.",
  },
  {
    strong: "Te",
    rest: " — admin helyett értékesítésre, beszerzésre kellene menned.",
  },
] as const;

const STEPS_INLINE = [
  { label: "API", desc: "összekötés" },
  { label: "Script", desc: "a sablonba" },
  { label: "Élő próba", desc: `${TRIAL_DAYS_DEFAULT} nap` },
] as const;

const PORTAL_PILLS = ["Partnerár", "Vevők", "Riport"] as const;

const FAQS = [
  {
    q: "Kell külön B2B webshop?",
    a: "Nem. A ProGate a meglévő Shoprenter boltra épül: a partner ott rendel, te a merchant portálon állítod az árakat és a widgetet.",
  },
  {
    q: "Mennyi idő az indulás?",
    a: "API összekötés, termékek betöltése, script a footerbe, partnerár beállítás. Sok bolt órák–napok alatt élő demót tud mutatni.",
  },
  {
    q: "Mi van a próba után?",
    a: `${TRIAL_DAYS_DEFAULT} nap után a ProGate ${formatPlanPrice(BASE_PRICE_HUF)} / hó bruttó. Ha a widgeten nem szeretnéd a ProGate feliratot: ${formatPlanPrice(WHITE_LABEL_PRICE_HUF)} / hó bruttó.`,
  },
] as const;

const FEATURED_VERTICALS = getFeaturedVerticals();

export function ProGateLanding() {
  return (
    <div className="pg">
      <ProGateLandingNav />

      <main id="top">
        {/* 1 — Hero */}
        <section className="pg-hero">
          <div className="pg-hero-main">
            <div className="pg-hero-grid">
              <div className="pg-hero-copy">
                <h1 className="pg-hero-lines">
                  <span>Gyorsabb feldolgozás neked.</span>
                  <span>Könnyebb rendelés a partnerednek.</span>
                  <span className="pg-em">Több forgalom mindkettőtöknek.</span>
                </h1>
                <div className="pg-hero-actions">
                  <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
                    Ingyen kipróbálom →
                  </Link>
                </div>
              </div>

              <ProGateLossCalc />
            </div>
          </div>

          <ProGateHeroBenefits />
        </section>

        {/* 2 — Trust */}
        <section className="pg-strip pg-strip--compact" id="hogyan" aria-label="Platform">
          <div className="pg-strip-logos">
            {TRUST_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </section>

        {/* 2b — Iparágak */}
        <section className="pg-section pg-section-kiknek" id="kiknek">
          <h2 className="pg-h2">Kiknek?</h2>
          <p className="pg-lead pg-kiknek-lead">
            Shoprenteres nagyker, ahol a partner listában rendel. Válaszd ki a
            szektorod — mindegyik oldalon konkrét helyzet, nem általános marketing.
          </p>
          <ul className="pg-kiknek-grid">
            {FEATURED_VERTICALS.map((v) => (
              <li key={v.slug}>
                <Link href={`/kiknek/${v.slug}`} className="pg-kiknek-card">
                  <span className="pg-kiknek-card-title">{v.footerLabel}</span>
                  <span className="pg-kiknek-card-pain">{v.pains[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="pg-kiknek-more">
            <Link href="/kiknek">Összes iparág ({PROGATE_VERTICALS.length}) →</Link>
          </p>
        </section>

        {/* 3 — Proof: loss + demo + steps + portal */}
        <section className="pg-section pg-section-proof" id="demo">
          <p className="pg-kicker">Amíg e-mailben rendelnek</p>
          <h2 className="pg-h2 pg-h2-wide">
            A partnered addig is a versenytársadnál rendelhet.
          </h2>

          <div className="pg-proof-split">
            <div className="pg-proof-copy">
              <ul className="pg-loss-list">
                {LOSS_LINES.map((line) => (
                  <li key={line.strong}>
                    <strong>{line.strong}</strong>
                    {line.rest}
                  </li>
                ))}
              </ul>

              <ol className="pg-steps-inline" aria-label="Indulás három lépésben">
                {STEPS_INLINE.map((step, i) => (
                  <li key={step.label}>
                    <span className="pg-steps-inline-num">{i + 1}</span>
                    <span className="pg-steps-inline-text">
                      <strong>{step.label}</strong>
                      <span>{step.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="pg-proof-actions">
                <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
                  Ingyen kipróbálom →
                </Link>
              </div>
            </div>

            <div className="pg-proof-visual">
              <ProGateHeroMocks embed />
            </div>
          </div>

          <div className="pg-portal-row" id="portal">
            <span className="pg-portal-row-label">Portálon irányítasz:</span>
            <div className="pg-portal-pills">
              {PORTAL_PILLS.map((pill) => (
                <span key={pill}>{pill}</span>
              ))}
            </div>
          </div>
        </section>

        {/* 4 — Decision: pricing + FAQ + close */}
        <section className="pg-section pg-section-alt pg-section-decision" id="csomag">
          <h2 className="pg-h2">
            {TRIAL_DAYS_DEFAULT} nap próba. Utána {formatPlanPrice(BASE_PRICE_HUF)} / hó.
          </h2>

          <div className="pg-price-single">
            <p className="pg-price-hero">
              {formatPlanPrice(BASE_PRICE_HUF)}
              <span>/ hó · bruttó</span>
            </p>
            <p className="pg-price-upsell">
              Felirat nélkül: {formatPlanPrice(WHITE_LABEL_PRICE_HUF)} / hó (+
              {formatPlanPrice(MARK_ADDON_HUF)})
            </p>
            <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary">
              {TRIAL_DAYS_DEFAULT} nap próba →
            </Link>
          </div>

          <div className="pg-faq" id="gyik">
            <h3 className="pg-faq-title">Gyakori kérdések</h3>
            {FAQS.map((item) => (
              <details key={item.q} className="pg-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>

          <div className="pg-decision-close">
            <h2>Indítsd ma a Shoprenter B2B réteget</h2>
            <p>
              {TRIAL_DAYS_DEFAULT} napos próba és közvetlen support — élő boltokkal
              finomhangoljuk a terméket.
            </p>
            <div className="pg-hero-actions">
              <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
                {TRIAL_DAYS_DEFAULT} nap próba
              </Link>
              <a href={DEMO_MAIL} className="pg-btn pg-btn-ghost-on-dark pg-btn-lg">
                Írj a {COMPANY.emails.support} címre
              </a>
            </div>
          </div>
        </section>
      </main>

      <ProGateLandingFooter />
    </div>
  );
}
