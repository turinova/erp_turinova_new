import "@/app/globals-landing.css";
import Link from "next/link";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { ProGateHeroMocks } from "@/components/marketing/ProGateHeroMocks";
import { ProGateLandingNav } from "@/components/marketing/ProGateLandingNav";
import {
  BASE_PRICE_HUF,
  MARK_ADDON_HUF,
  TRIAL_DAYS_DEFAULT,
  WHITE_LABEL_PRICE_HUF,
  formatPlanPrice,
} from "@/lib/billing/plans";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";
import { appAuthHref } from "@/lib/hosts";

const DEMO_MAIL = `mailto:${COMPANY.emails.support}?subject=${encodeURIComponent("ProGate demo")}`;

/** 7-block one-pager IA — nav locked; pillars/early/proof folded in. */

const STEPS = [
  {
    title: "API összekötés",
    body: "Shoprenter API a merchant portálon. Termékek és vevők betöltése — innen indul a B2B réteg.",
  },
  {
    title: "Script a sablonba",
    body: "Egy snippet a footerbe. A gyors rendelés a meglévő bolton jelenik meg, külön URL nélkül.",
  },
  {
    title: "Partnerár + próba",
    body: `${TRIAL_DAYS_DEFAULT} nap teljes termék. Első partnereknek élő demó gyakran órák–napok alatt.`,
  },
] as const;

const DEMO_POINTS = [
  {
    title: "Kereső és tömeges lista",
    body: "Cikkszám, gyári szám, vonalkód. Excel, beillesztett szöveg vagy fotó a papírlistáról.",
  },
  {
    title: "Élő partnerár és készlet",
    body: "Nettó/bruttó, sávos kedvezmény, pack szabályok — majd kosárba egy kattintással.",
  },
  {
    title: "Újrarendelés és listák",
    body: "Korábbi rendelések visszatöltése, mentett listák, javaslatok a gyakori tételekre.",
  },
] as const;

const FEATURES = [
  {
    title: "Partnerár-motor",
    body: "Fix kivétel → mennyiségi sáv → csoport % → listaár. Tömeges szerkesztés kategóriára és gyártóra.",
  },
  {
    title: "Automatizmus",
    body: "Szabályok: költés vagy rendelésszám alapján csoportváltás. A widgeten látszik a következő szint.",
  },
  {
    title: "Vevők és riport",
    body: "Partnerek, forgalom, top termékek, widget vs. bolti mix — látod, mit hoz a B2B réteg.",
  },
  {
    title: "Tudásbázis",
    body: "Összekötés, script, szinkron, Excel — tegezve, lépésről lépésre a portálban.",
  },
] as const;

const FAQS = [
  {
    q: "Kell külön B2B webshop?",
    a: "Nem. A ProGate a meglévő Shoprenter boltra épül: a partner ott rendel, te a merchant portálon állítod az árakat és a widgetet.",
  },
  {
    q: "Miben több, mint a Shoprenter vevőcsoport-kedvezmény?",
    a: "Egy helyen kezeled a %, a fix árakat és a sávokat, van tömeges munka, automatikus szintlépés, riport — a bolton pedig gyors rendelés Excel/fotó/újrarendeléssel.",
  },
  {
    q: "Mennyi idő az indulás?",
    a: "API összekötés, termékek betöltése, script a footerbe, partnerár beállítás. Sok bolt órák–napok alatt élő demót tud mutatni.",
  },
  {
    q: "Mi van a próba után?",
    a: `${TRIAL_DAYS_DEFAULT} nap teljes termék. Utána a Gyors rendelés csomag ${formatPlanPrice(BASE_PRICE_HUF)} / hó bruttó; saját márka opcióval a ProGate felirat elrejthető.`,
  },
  {
    q: "Kiknek szól most?",
    a: "Shoprenteres nagyker / viszonteladós boltoknak. Multi-platform és Sales Agent funkciók nincsenek a scope-ban — a fókusz: partnerár + gyors rendelés a meglévő bolton.",
  },
] as const;

export function ProGateLanding() {
  return (
    <div className="pg">
      <ProGateLandingNav />

      <main id="top">
        {/* 1 — Hero */}
        <section className="pg-hero">
          <div className="pg-hero-grid">
            <div className="pg-hero-copy">
              <h1>
                Valódi nagyker a bolton,{" "}
                <span className="pg-em">amit már futtatsz.</span>
              </h1>
              <p className="pg-hero-lead">
                B2B réteg a Shoprenteredre: a viszonteladók partneráron
                rendelnek, te egy portálon árazol — külön B2B shop nélkül.
              </p>
              <div className="pg-hero-actions">
                <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
                  Ingyen kipróbálom →
                </Link>
                <a href="#demo" className="pg-btn pg-btn-ghost-on-dark pg-btn-lg">
                  Így látja a partner →
                </a>
              </div>
              <p className="pg-hero-trust">
                {TRIAL_DAYS_DEFAULT} nap · kártya nélkül · magyar support
                <span aria-hidden> · </span>
                <Link href={appAuthHref("/login")}>Belépés</Link>
              </p>
            </div>

            <ProGateHeroMocks />
          </div>
        </section>

        {/* 2 — Trust strip */}
        <section className="pg-strip" aria-label="Platform">
          <p>A meglévő Shoprenter boltodra épül</p>
          <div className="pg-strip-logos">
            <span>Shoprenter-natív</span>
            <span>Partnerár</span>
            <span>Widget</span>
            <span>{TRIAL_DAYS_DEFAULT} nap próba</span>
          </div>
        </section>

        {/* 3 — How it works (pillars folded into steps) */}
        <section className="pg-section" id="hogyan">
          <p className="pg-kicker">Indulás</p>
          <h2 className="pg-h2">Három lépés a meglévő bolton</h2>
          <p className="pg-lead">
            Nincs külön B2B shop. A partner a boltodon rendel, te a portálon
            irányítasz — API, script, partnerár.
          </p>
          <div className="pg-steps">
            {STEPS.map((s, i) => (
              <article key={s.title} className="pg-card">
                <span className="pg-step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4 — Product demo */}
        <section className="pg-section pg-section-alt" id="demo">
          <p className="pg-kicker">Bolti élmény</p>
          <h2 className="pg-h2">Így rendel a partner</h2>
          <p className="pg-lead">
            A megszokott bolton nyit egy gyors rendelőt. Nem kell külön URL, nem
            kell e-mailben Excel-t küldözgetni.
          </p>
          <ul className="pg-demo-points">
            {DEMO_POINTS.map((w) => (
              <li key={w.title}>
                <strong>{w.title}</strong>
                <span>{w.body}</span>
              </li>
            ))}
          </ul>
          <div className="pg-inline-cta">
            <a href="#top" className="pg-btn pg-btn-primary">
              Próbáld a demót felül
            </a>
            <a href="#csomag" className="pg-link-quiet">
              Árak →
            </a>
          </div>
        </section>

        {/* 5 — Value (merchant portal) */}
        <section className="pg-section" id="portal">
          <p className="pg-kicker">Merchant portál</p>
          <h2 className="pg-h2">Te a portálon irányítasz</h2>
          <p className="pg-lead">
            Árazás, vevők, automatizmus, riport. Beállítod, a boltban él.
          </p>
          <div className="pg-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="pg-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 6 — Pricing (early-access folded into lead) */}
        <section className="pg-section pg-section-alt" id="csomag">
          <h2 className="pg-h2">Egyszerű csomagok</h2>
          <p className="pg-lead">
            Teljes termék a próba alatt — első Shoprenteres partnereknek közvetlen
            support. Utána egy alapár; a saját márka opcionális.
          </p>
          <p className="pg-pricing-note">
            {TRIAL_DAYS_DEFAULT} nap, kártya nélkül.
          </p>
          <div className="pg-pricing">
            <article className="pg-price-card pg-price-card-hl">
              <h3>Gyors rendelés</h3>
              <p className="pg-price">
                {formatPlanPrice(BASE_PRICE_HUF)}
                <span>/ hó · bruttó</span>
              </p>
              <ul>
                <li>Widget + merchant portál</li>
                <li>Partnerár, vevők, riport</li>
                <li>ProGate felirat a widgeten</li>
                <li>{TRIAL_DAYS_DEFAULT} nap próba</li>
              </ul>
              <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary">
                Kezdd a próbát
              </Link>
            </article>
            <article className="pg-price-card">
              <h3>Saját márka</h3>
              <p className="pg-price">
                {formatPlanPrice(WHITE_LABEL_PRICE_HUF)}
                <span>/ hó · bruttó</span>
              </p>
              <ul>
                <li>Minden a Gyors rendelésből</li>
                <li>
                  ProGate felirat nélkül (+{formatPlanPrice(MARK_ADDON_HUF)})
                </li>
                <li>Ugyanaz a termék, white-label widget</li>
              </ul>
              <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-ghost">
                Próbából választok
              </Link>
            </article>
          </div>
        </section>

        {/* 7 — FAQ + close */}
        <section className="pg-section" id="gyik">
          <h2 className="pg-h2">Gyakori kérdések</h2>
          <div className="pg-faq">
            {FAQS.map((item) => (
              <details key={item.q} className="pg-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pg-cta-band">
          <h2>Indítsd a Shoprenter B2B réteget</h2>
          <p>
            {TRIAL_DAYS_DEFAULT} napos próba és közvetlen support — nem
            marketing-lista, hanem élő boltokkal finomhangoljuk a terméket. Ha
            Shoprenteres nagykered van, írj nekünk.
          </p>
          <div className="pg-hero-actions">
            <Link href={appAuthHref("/signup")} className="pg-btn pg-btn-primary pg-btn-lg">
              {TRIAL_DAYS_DEFAULT} nap próba
            </Link>
            <a
              href={DEMO_MAIL}
              className="pg-btn pg-btn-ghost-on-dark pg-btn-lg"
            >
              Írj a {COMPANY.emails.support} címre
            </a>
          </div>
        </section>
      </main>

      <footer className="pg-footer">
        <div className="pg-footer-grid">
          <div>
            <p className="pg-logo">
              <TurinovaWordmark height={36} />
            </p>
            <p className="pg-footer-muted">{COMPANY.brandTagline}</p>
          </div>
          <div>
            <p className="pg-footer-h">Termék</p>
            <a href="#hogyan">Hogyan működik</a>
            <a href="#demo">Demó</a>
            <a href="#portal">Portál</a>
            <a href="#csomag">Csomagok</a>
            <Link href={appAuthHref("/signup")}>Regisztráció</Link>
            <Link href={appAuthHref("/login")}>Belépés</Link>
          </div>
          <div>
            <p className="pg-footer-h">Jogi</p>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
          <div>
            <p className="pg-footer-h">Kapcsolat</p>
            <a href={`mailto:${COMPANY.emails.support}`}>
              {COMPANY.emails.support}
            </a>
            <a href={COMPANY.website} target="_blank" rel="noopener noreferrer">
              {COMPANY.websiteHost}
            </a>
            <p className="pg-footer-muted">{COMPANY.shortName}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
