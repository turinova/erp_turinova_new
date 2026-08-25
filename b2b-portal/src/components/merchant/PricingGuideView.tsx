import Link from "next/link";

type Strategy = {
  id: string;
  title: string;
  oneLiner: string;
  example: string;
  where: string;
  note?: string;
  soon?: boolean;
  icon: "percent" | "lock" | "select" | "tag" | "stack" | "cost";
};

const STRATEGIES: Strategy[] = [
  {
    id: "csoport",
    title: "Csoport −%",
    oneLiner: "Az egész vevőcsoportnak olcsóbb a listaárnál.",
    example: "Viszonteladók: minden termék −15%.",
    where: "Árazás → Szabály fül → csúszka",
    note: "A fix áras termékekre ez nem hat.",
    icon: "percent",
  },
  {
    id: "fix",
    title: "Fix Ft",
    oneLiner: "Ennek a terméknek ennyi forint — kész.",
    example: "AL250: 12 400 Ft, bármi is a csoport %.",
    where: "Árazás → Kivételek fül → Partner cella · Csak fix",
    note: "Üres mentés törli → vissza a %-ra / listára.",
    icon: "lock",
  },
  {
    id: "kijeloles",
    title: "Kijelöltek −%",
    oneLiner: "Csak a kiválasztottakra (vagy egy márkára) számolsz −%-ot, és fix árat mentesz.",
    example: "Csak a StrongLegs márkára −20%.",
    where: "Árazás → Kivételek → kijelölés vagy márka „Ezekre mind”",
    note: "Csoport % = mindenkinek. Ez = csak ezeknek, és fix árat ír.",
    icon: "select",
  },
  {
    id: "cost",
    title: "Beszer + %",
    oneLiner: "A beszerzési árból számolsz árrést, és fix partnerárként mented.",
    example: "Beszer 8 000 + 25% → 10 000 Ft fix.",
    where: "Árazás → Kivételek → szerkesztés (+20/+25%) vagy Beszer+% bulk",
    note: "Nem automatikus — te mented. Üres beszerzésnél kihagyjuk.",
    icon: "cost",
  },
  {
    id: "bolti",
    title: "Bolti ár",
    oneLiner: "A kiindulópont — ezt látja, aki nincs partner.",
    example: "Lista 10 000 → innen −15% = 8 500.",
    where: "Árazás → Kivételek → Bolti oszlop",
    note: "A bruttó most 27% ÁFÁ-val becsült.",
    icon: "tag",
  },
  {
    id: "sav",
    title: "Mennyiség",
    oneLiner: "Sok darab = olcsóbb.",
    example: "1–9 db lista/%, 10+ db fix olcsóbb ár.",
    where: "Árazás → Sávok fül → Sáv →",
    note: "Fix partnerár továbbra is mindent felülír (1 db-nál is).",
    icon: "stack",
  },
];

const FAQ = [
  {
    q: "Mi a különbség a csoport −15% és a kijelöltek −15% között?",
    a: "Csoport % = minden termékre a csoportnak (kivéve fix). Kijelölés = csak azokra a termékekre, és fix árat ment.",
  },
  {
    q: "Ha van fix ár és csoport % is, mit lát a vevő?",
    a: "A fix árat.",
  },
  {
    q: "Mi a különbség a lista −% és a Beszer +% között?",
    a: "Lista −% a bolti árból számol. Beszer +% a beszerzési árból. Mindkettő fix árat ment.",
  },
  {
    q: "A bruttó miért nem egyezik a bolttal?",
    a: "A portál most 27%-kal számol. Pontos ÁFA termékenként később jön.",
  },
];

function Icon({ name }: { name: Strategy["icon"] }) {
  const c = "h-5 w-5 shrink-0 text-text";
  if (name === "percent") {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="16.5" cy="16.5" r="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M18 6 6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
      </svg>
    );
  }
  if (name === "lock") {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="10" width="14" height="10" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M8 10V7a4 4 0 0 1 8 0v3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
    );
  }
  if (name === "select") {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 6h10M4 12h16M4 18h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
        <path d="m15 16 2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
      </svg>
    );
  }
  if (name === "cost") {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v18M8 8c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5-1.8 2.5-4 2.5-4 1-4 2.5 1.8 2.5 4 2.5 4-1 4-2.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
    );
  }
  if (name === "tag") {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 12V4h8l10 10-8 8z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="miter"
        />
        <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="14" width="16" height="5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="6" y="9" width="12" height="5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="8" y="4" width="8" height="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function PricingGuideView() {
  return (
    <div className="mx-auto w-full max-w-4xl pb-16">
      <header className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight text-text md:text-[26px]">
          Partnerárak — melyiket válaszd?
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-faint">
          Amit beállítasz, a vevő a boltban ezt fizeti.
        </p>
      </header>

      <section className="mb-10 border border-line-strong bg-surface-2 p-4 md:p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          Melyik ár győz?
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="border-2 border-text bg-surface px-2.5 py-1.5 font-semibold text-text">
            Fix Ft
          </span>
          <span className="text-faint" aria-hidden>
            →
          </span>
          <span className="border border-line-strong bg-surface px-2.5 py-1.5 font-semibold text-text">
            Mennyiség
          </span>
          <span className="text-faint" aria-hidden>
            →
          </span>
          <span className="border border-line-strong bg-surface px-2.5 py-1.5 font-semibold text-text">
            Csoport −%
          </span>
          <span className="text-faint" aria-hidden>
            →
          </span>
          <span className="border border-line-strong bg-surface px-2.5 py-1.5 font-medium text-faint">
            Bolti ár
          </span>
        </div>
        <p className="mt-3 text-[13px] text-text">
          Ha adtál fix árat, a −15% és a sáv már nem számít.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STRATEGIES.map((s) => (
          <article
            key={s.id}
            id={s.id === "sav" ? "mennyisegi-sav" : undefined}
            className={
              s.soon
                ? "flex flex-col border border-line-strong bg-surface p-5 opacity-70"
                : "flex flex-col border border-line-strong bg-surface p-5 transition-colors hover:border-text"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Icon name={s.icon} />
                <h3 className="text-[16px] font-semibold text-text">{s.title}</h3>
              </div>
              {s.soon ? (
                <span className="shrink-0 border border-line-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                  Hamarosan
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-[14px] font-medium leading-snug text-text">
              {s.oneLiner}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              <span className="font-semibold text-text">Példa:</span> {s.example}
            </p>

            <dl className="mt-4 space-y-1.5 text-[12px]">
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-faint">Hol</dt>
                <dd className="text-text">{s.where}</dd>
              </div>
              {s.note ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-faint">⚠</dt>
                  <dd className="text-text">{s.note}</dd>
                </div>
              ) : null}
            </dl>

            {!s.soon ? (
              <div className="mt-auto pt-5">
                <Link
                  href="/arak"
                  className="inline-flex h-8 cursor-pointer items-center border border-line-strong px-3 text-[12px] font-semibold text-text hover:bg-surface-2"
                >
                  Beállítom →
                </Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <aside className="mt-8 border-l-2 border-text bg-surface-2 px-4 py-4">
        <p className="text-[13px] font-semibold text-text">Árrés figyelmeztetés</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
          A Kivételek fülön állíthatod a{" "}
          <span className="text-text">min. árrés %</span>-ot. Ha a partnerár
          ez alá megy, sárga jelzés — nem blokkol, csak figyelmeztet.
        </p>
      </aside>

      <section className="mt-10">
        <h3 className="text-[15px] font-semibold text-text">Gyakori kérdések</h3>
        <div className="mt-3 divide-y divide-line-strong border border-line-strong">
          {FAQ.map((item) => (
            <details key={item.q} className="group bg-surface open:bg-surface-2">
              <summary className="cursor-pointer list-none px-4 py-3.5 text-[13px] font-semibold text-text marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span
                    className="shrink-0 text-faint transition-transform group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="px-4 pb-4 text-[13px] leading-relaxed text-faint">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-3 border-t border-line-strong pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-faint">
          A partnerárakat a Shoprenterbe mentjük.
        </p>
        <Link
          href="/arak"
          className="tn-btn tn-btn-primary inline-flex h-9 cursor-pointer items-center justify-center px-4 text-[13px]"
        >
          Ugrás az Árazásra
        </Link>
      </div>
    </div>
  );
}
