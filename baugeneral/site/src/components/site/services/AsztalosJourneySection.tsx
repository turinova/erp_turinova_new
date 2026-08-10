import { HIROS_ABLAK } from "@/lib/links"

const JOURNEY_STEPS = [
  {
    step: "01",
    title: "Terv és egyeztetés",
    description:
      "Helyszín, méret, anyag és határidő. A BauGenerál összefogja az igényt a kivitelezés ütemével.",
    image: "/img/asztalos/bemutato.jpg",
    imageAlt: "Hírös-Ablak bemutatóterem: bútorlap- és fogantyúminták Kecskeméten",
  },
  {
    step: "02",
    title: "Lapszabászat",
    description:
      "Pontos méretre vágás a Hírös-Ablak saját üzemében, automata táblafelosztón.",
    image: "/img/asztalos/lapszabaszat-biesse.jpg",
    imageAlt: "Lapszabászat: táblafelosztó gép vágás közben a Hírös-Ablak üzemben",
  },
  {
    step: "03",
    title: "Élzárás és gyártás",
    description:
      "Élzárás, frontok, testek, munkalap, egyedi bútor összeszerelése a partnerüzemben.",
    image: "/img/asztalos/elzaro.jpg",
    imageAlt: "Élzárógép a Hírös-Ablak kecskeméti gyártóüzemében",
  },
  {
    step: "04",
    title: "Beépítés és átadás",
    description:
      "Helyszíni beépítés a kivitelezés üteméhez igazítva. Kulcsrakész, bútorozott átadás.",
    image: "/img/asztalos/telephely-udvar.jpg",
    imageAlt: "Hírös-Ablak faipari telephely Kecskeméten, Mindszenti krt. 10.",
  },
] as const

export function AsztalosJourneySection() {
  return (
    <section
      aria-labelledby="asztalos-journey-heading"
      className="mx-auto max-w-6xl px-4"
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/45">
        Folyamat
      </p>
      <h2
        id="asztalos-journey-heading"
        className="mt-2 font-display text-2xl font-semibold tracking-tight text-black/90 md:text-3xl"
      >
        A tervtől a bútorig
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 md:text-base">
        Generálkivitelezés és saját partnerüzemi gyártás egy ütemben. A lapszabászat
        és az egyedi bútor a {HIROS_ABLAK.brand} Kft. üzemben készül; a beépítést a
        BauGenerál fogja össze.
      </p>

      <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY_STEPS.map((item) => (
          <li key={item.step} className="min-w-0">
            <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)]">
              <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">
                  {item.step}
                </p>
                <h3 className="font-display text-base font-semibold text-black/90">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-black/60">{item.description}</p>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
