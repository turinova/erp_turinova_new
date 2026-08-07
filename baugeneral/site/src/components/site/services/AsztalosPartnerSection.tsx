import { HIROS_ABLAK } from "@/lib/links"

const PARTNER_FACTS = [
  { label: "Üzem", value: "kb. 1500 m²" },
  { label: "Bemutatóterem", value: "500 m²" },
  { label: "Mióta", value: "1996" },
  { label: "Cím", value: "Kecskemét, Mindszenti krt. 10." },
] as const

export function AsztalosPartnerSection() {
  return (
    <section
      aria-labelledby="asztalos-partner-heading"
      className="mx-auto max-w-6xl px-4"
    >
      <div className="grid gap-8 overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-card)] md:grid-cols-2 md:gap-0">
        <div className="relative min-h-[240px] md:min-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/asztalos/telephely-drone.jpg"
            alt="Hírös-Ablak faipari üzem és áruház Kecskeméten, drónfelvétel"
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
          />
        </div>

        <div className="flex flex-col justify-center p-6 md:p-8 lg:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/45">
            Gyártó partner
          </p>
          <h2
            id="asztalos-partner-heading"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-black/90 md:text-3xl"
          >
            {HIROS_ABLAK.brand}: saját üzem, lapszabászat, egyedi bútor
          </h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-black/70 md:text-base">
            Az egyedi beépített bútorokat és konyhákat a {HIROS_ABLAK.legalName}{" "}
            gyártja Kecskeméten, saját üzemben: lapszabászat és élzárás automata
            gépeken, 1996 óta. A BauGenerál a generálkivitelezést és a helyszíni
            beépítést fogja össze. Két külön cég, kapcsolódó tulajdonosi kör.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            {PARTNER_FACTS.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[0.65rem] uppercase tracking-wide text-black/45">
                  {fact.label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-black/85">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={HIROS_ABLAK.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex px-4 py-2.5 text-sm font-semibold"
            >
              {HIROS_ABLAK.brand} weboldal
            </a>
            <a
              href={HIROS_ABLAK.lapszabaszat}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--color-brand)] underline-offset-4 hover:underline"
            >
              Lapszabászat Kecskeméten
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
