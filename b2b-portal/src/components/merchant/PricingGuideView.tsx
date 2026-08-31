import Link from "next/link";

const STRATEGIES = [
  {
    title: "Csoport kedvezmény %",
    body: "Az egész vevőcsoportra vonatkozó százalékos kedvezmény. A Szabály fülön állítod.",
    href: "/arak",
    cta: "Árazás megnyitása",
  },
  {
    title: "Fix partnerár",
    body: "Egyedi nettó ár termékenként. Felülírja a csoport %-ot — ha fix ár van, az győz.",
    href: "/arak",
    cta: "Kivételek fül",
  },
  {
    title: "Lista −% (bulk)",
    body: "Kijelölt termékekre vagy gyártó/kategória szerint fix ár a bolti árból számolva.",
    href: "/arak",
    cta: "Tömeges műveletek",
  },
  {
    title: "Mennyiségi sáv",
    body: "Termékenként mennyiség → ár (Shoprenter productSpecials). A Sávok fülön szerkeszted.",
    href: "/arak",
    cta: "Sávok fül",
  },
  {
    title: "Bolti listaár",
    body: "Referencia — ha nincs partnerár, a vevő a bolti árat látja.",
    href: "/arak",
    cta: null,
  },
] as const;

const FAQ = [
  {
    q: "Mi a különbség a csoport % és a bulk −% között?",
    a: "A csoport % az egész csoportra vonatkozik. A bulk a kijelölt termékekre állít fix árat — nem automatikus minden SKU-ra.",
  },
  {
    q: "Fix ár vagy csoport % — melyik érvényes?",
    a: "Fix partnerár mindig győz. Utána mennyiségi sáv, majd csoport %, végül bolti ár.",
  },
  {
    q: "Miért bruttót látok néhol?",
    a: "A portál bruttót mutat becslésként (27% ÁFA). A Shoprenterbe nettó megy; a bolt a SR beállításaid szerint jelenít meg.",
  },
] as const;

export function PricingGuideView() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <h1 className="text-[20px] font-semibold tracking-tight text-text">
        Hogyan árazz B2B partnereket?
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-faint">
        Amit itt beállítasz, a partner a boltban azt fizeti. Az igazság forrása a
        Shoprenter — a portál tükrözi és szinkronizál.
      </p>

      <section className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Melyik ár győz?
        </p>
        <p className="mt-2 text-[13px] font-medium text-text">
          Fix Ft → Mennyiségi sáv → Csoport −% → Bolti ár
        </p>
        <p className="mt-1 text-[12px] text-faint">
          Ha adtál fix árat, a csoport kedvezmény már nem számít arra a termékre.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Stratégiák
        </p>
        {STRATEGIES.map((s) => (
          <article
            key={s.title}
            className="border-[1.5px] border-line-strong bg-surface p-4"
          >
            <h2 className="text-[14px] font-semibold text-text">{s.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-faint">{s.body}</p>
            {s.cta ? (
              <Link
                href={s.href}
                className="mt-3 inline-block text-[12px] font-semibold underline underline-offset-4"
              >
                {s.cta} →
              </Link>
            ) : null}
          </article>
        ))}
      </section>

      <section className="mt-8 border-[1.5px] border-line-strong bg-surface-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Beszerzés és árrés
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-faint">
          Ha a Shoprenterben kitöltötted a beszerzési árat, az Árazás oldalon látod
          az árrés figyelmeztetést. Üres cost esetén „—” — ez nem hiba.
        </p>
      </section>

      <section className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          GYIK
        </p>
        <ul className="mt-3 divide-y divide-line border border-line-strong">
          {FAQ.map((item) => (
            <li key={item.q} className="px-3 py-3">
              <p className="text-[13px] font-semibold text-text">{item.q}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-faint">{item.a}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Link
          href="/arak"
          className="inline-flex h-9 items-center bg-accent px-4 text-[13px] font-semibold text-white"
        >
          Árazás megnyitása
        </Link>
      </div>
    </div>
  );
}
