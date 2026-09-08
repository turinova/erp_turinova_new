"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY } from "@/lib/company";

const MAP = [
  {
    href: "/sr-embed",
    title: "Kezdőlap",
    hint: "Itt látod, él-e a gyors rendelés, és innen telepíted vagy kapcsolod be.",
  },
  {
    href: "/sr-embed/widget",
    title: "Widget",
    hint: "Itt állítod a gomb színét, feliratát, helyét, és a partner láblécét.",
  },
  {
    href: "/sr-embed/elofizetes",
    title: "Előfizetés",
    hint: "Próbaidő, árak és fizetés.",
  },
  {
    href: "/sr-embed/szamlazas",
    title: "Számlázás",
    hint: "Előfizetés státusza és charge azonosító.",
  },
] as const;

const START_STEPS = [
  "A Kezdőlapon nyomd meg: Telepítem a boltra.",
  "A Widget oldalon mentsd el a beállításokat.",
  "Nyisd meg a webshopot bejelentkezett viszonteladóval, és próbáld ki a gombot.",
  "Ha nincs úszó gomb, adj menüpontot. Az URL legyen: #sr-b2b-qo",
] as const;

const PARTNER_CAN = [
  "Cikkszám alapján keres és listáz.",
  "Excelből, szövegből vagy fotóról is fel tud tölteni listát.",
  "Mentett listákat vezet, és újra tud rendelni belőlük.",
  "Látja a korábbi rendeléseit.",
  "A saját vevőcsoportja szerinti partnerárat kapja.",
] as const;

const FAQ_ITEMS = [
  {
    q: "Hol kapcsolom be a gombot?",
    a: "A Kezdőlapon. Ha a script már bent van, a Bekapcsolom a gombot gombra kattints. Utána nézd meg a boltot.",
  },
  {
    q: "Hol állítom a gomb színét és feliratát?",
    a: "A Widget menüben, a Gomb fülön. Mentés után a bolton frissíts, hogy lásd a változást.",
  },
  {
    q: "Hol kapcsolom be a csoportnevet vagy a következő szintet?",
    a: "A Widget menüben, az Extra fülön. Ezek a panel alján jelennek meg a partnernek.",
  },
  {
    q: "Nem látom a gombot a bolton. Mi lehet?",
    a: "Nézd a Kezdőlapot: legyen telepítve és bekapcsolva. Frissítsd a boltot erősen (hard refresh). Ha továbbra sincs gomb, tegyél menüpontot #sr-b2b-qo címmel.",
  },
  {
    q: "Csak a menüből akarom megnyitni, úszó gomb nélkül.",
    a: "Widget → Gomb: kapcsold ki a FAB megjelenítését. A Shoprenterben adj menüpontot, az URL legyen #sr-b2b-qo.",
  },
  {
    q: "Mobilon zavaró a gomb. Mit tegyek?",
    a: "Állítsd ikon méretre a Widget → Gomb fülön, vagy kapcsold ki a FAB-ot, és használd a menüpontot.",
  },
  {
    q: "A partner belép, de üres vagy nem működik. Miért?",
    a: "A viszonteladónak be kell jelentkeznie a Shoprenterben. Ellenőrizd, hogy B2B vevőcsoportban van-e, és hogy a katalógus kész-e a Kezdőlapon.",
  },
  {
    q: "Az ár nem stimmel a panelen.",
    a: "A ProGate a Shoprenter vevőcsoport-árát mutatja. Nézd meg a vevő csoportját a bolt adminjában.",
  },
  {
    q: "Meddig tart a próbaidőszak?",
    a: "14 nap. A részleteket és a fizetést az Előfizetés oldalon találod.",
  },
] as const;

function FaqArrow({ open }: { open: boolean }) {
  return (
    <span
      className="mt-0.5 shrink-0 text-faint transition-transform duration-150"
      style={{ transform: open ? "rotate(90deg)" : undefined }}
      aria-hidden
    >
      <svg viewBox="64 64 896 896" width="12" height="12" fill="currentColor">
        <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z" />
      </svg>
    </span>
  );
}

export function EmbedHelpClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-[720px] pb-12">
      <header className="mb-6">
        <h1
          className="text-[28px] font-semibold leading-none tracking-tight text-text md:text-[34px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Súgó
        </h1>
        <p className="mt-2 max-w-[34rem] text-[15px] leading-snug text-muted">
          Rövid útmutató: mit hol találsz, hogyan indulsz, és mit lát a partner.
        </p>
      </header>

      <section className="mb-8">
        <h2
          className="text-[18px] font-semibold tracking-tight text-text"
          style={{ letterSpacing: "-0.02em" }}
        >
          Hol mit találsz
        </h2>
        <ul className="mt-3 border-t border-line-strong">
          {MAP.map((item) => (
            <li key={item.href} className="border-b border-line-strong">
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 py-3.5 no-underline hover:bg-surface-2/60"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-text">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-faint">
                    {item.hint}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 text-[16px] text-faint" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2
          className="text-[18px] font-semibold tracking-tight text-text"
          style={{ letterSpacing: "-0.02em" }}
        >
          Gyors indulás
        </h2>
        <ol className="mt-3 space-y-3 border-[1.5px] border-line-strong bg-surface px-4 py-4">
          {START_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[14px] text-text">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center border border-line-strong bg-surface-2 text-[12px] font-bold"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="leading-snug pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2
          className="text-[18px] font-semibold tracking-tight text-text"
          style={{ letterSpacing: "-0.02em" }}
        >
          Mit tud a partner a panelen
        </h2>
        <ul className="mt-3 space-y-2.5">
          {PARTNER_CAN.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[14px] text-text">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-ok text-[11px] font-bold text-white"
                aria-hidden
              >
                ✓
              </span>
              <span className="leading-snug">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line-strong pt-8">
        <h2
          className="text-[22px] font-semibold tracking-tight text-text"
          style={{ letterSpacing: "-0.02em" }}
        >
          Gyakran ismételt kérdések
        </h2>
        <div className="mt-4 border-t border-line-strong" role="list">
          {FAQ_ITEMS.map((item, i) => {
            const open = openFaq === i;
            return (
              <div
                key={item.q}
                className="border-b border-line-strong"
                role="listitem"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full cursor-pointer items-start gap-3 py-3.5 text-left"
                >
                  <FaqArrow open={open} />
                  <span className="text-[15px] font-semibold leading-snug text-text">
                    {item.q}
                  </span>
                </button>
                {open ? (
                  <div className="pb-4 pl-[27px] pr-1">
                    <p className="text-[14px] leading-relaxed text-muted">{item.a}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-8 text-[13px] text-faint">
        Elakadtál? Írj ide:{" "}
        <a
          href={`mailto:${COMPANY.emails.support}`}
          className="font-semibold text-text underline underline-offset-2"
        >
          {COMPANY.emails.support}
        </a>
      </p>
    </div>
  );
}
