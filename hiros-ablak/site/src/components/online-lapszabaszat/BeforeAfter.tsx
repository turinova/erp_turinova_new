/**
 * "Eddig vs Turinova" comparison: generic phrasing, no competitor names.
 * Carpenter-focused pain → solution mapping.
 */

const EDDIG = [
  "E-mailben vagy telefonon adja le a rendelést",
  "Az árajánlat 1–3 napot vár",
  "A szabásterv csak gyártás után látható",
  "Telefonon kérdezi, hol tart a rendelés",
  "Papír árajánlat, e-mail melléklet, később nehezen kereshető",
] as const

const TURINOVA = [
  "Online felület, Ön állítja össze",
  "Azonnali ár, panelenként",
  "Vizuális szabásterv és PDF letöltés",
  "Valós idejű követés, SMS amint kész",
  "Mentett projektek, bármikor folytatható",
] as const

export default function BeforeAfter() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Eddig: muted card */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          Eddig
        </p>
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          A hagyományos út
        </h3>
        <ul className="space-y-2.5">
          {EDDIG.map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-1 inline-block w-4 h-4 rounded-full border border-slate-300 bg-white shrink-0"
              />
              <span className="text-sm text-slate-600 leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Turinova: branded card */}
      <div
        className="relative rounded-2xl border-2 p-6 sm:p-7"
        style={{
          borderColor: "var(--color-brand)",
          background:
            "linear-gradient(180deg, rgba(151,29,37,0.04) 0%, rgba(255,255,255,1) 70%)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand)] mb-1">
          Turinova
        </p>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          A Turinova-val
        </h3>
        <ul className="space-y-2.5">
          {TURINOVA.map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 inline-flex w-4 h-4 rounded-full bg-[var(--color-brand)] text-white items-center justify-center shrink-0"
              >
                <svg
                  className="w-2.5 h-2.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </span>
              <span className="text-sm font-medium text-slate-800 leading-snug">
                {t}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
