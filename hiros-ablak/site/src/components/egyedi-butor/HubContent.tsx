import Link from "next/link"
import FaqAccordion from "@/components/site/FaqAccordion"
import TelClickLink from "@/components/egyedi-butor/TelClickLink"
import {
  HUB_FACTS,
  HUB_FAQ,
  KONYHA_PRICE_FROM,
  SPOKE_PAGES,
  SURVEY_AREAS,
  SURVEY_STEPS,
} from "@/lib/egyedi-butor-data"

/**
 * A hirdetésből érkező forgalom a heróban és a galériában dönt, ezért minden
 * szöveges tartalom a galéria alá kerül. Szerver komponens: az itteni szöveg
 * a kiszolgált HTML-ben van, keresőnek és AI-válaszmotornak is olvashatóan.
 */

const H2 = "text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
const LEAD = "mt-4 text-base leading-relaxed text-black/70"
const INLINE_LINK =
  "font-medium text-[var(--color-brand)] underline decoration-[var(--color-brand)]/30 underline-offset-4 hover:decoration-[var(--color-brand)]"

export default function HubContent({
  phoneDisplay,
  phoneTel,
}: {
  phoneDisplay: string
  phoneTel: string
}) {
  return (
    <div className="bg-white">
      {/* Tények — crawlable, idézhető blokk */}
      <section
        className="border-t border-black/8"
        aria-label="Röviden a szolgáltatásról"
      >
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Röviden
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {HUB_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-black/8 bg-stone-wash/60 px-4 py-3.5"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-black/75">
                  {fact.text}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-black/55">
            Egyedi konyha {KONYHA_PRICE_FROM.label}. Felmérés:{" "}
            <TelClickLink
              href={phoneTel}
              location="hub_facts"
              phoneDisplay={phoneDisplay}
              className={INLINE_LINK}
            >
              {phoneDisplay}
            </TelClickLink>
            .
          </p>
        </div>
      </section>

      {/* Amit gyártunk – belső linkek az aloldalakra */}
      <section className="border-t border-black/8 bg-stone-wash">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className={H2}>Bútorlapot 1996 óta szabunk</h2>
          <p className={LEAD}>
            A konyháinkat és a gardróbjainkat ugyanazokon a gépeken vágjuk,
            amelyeken a szakmának is dolgozunk Kecskeméten. A különbség annyi,
            hogy itt nem egy katalógus adja a méretet, hanem az Ön fala. Van,
            aki egyetlen mosdószekrényt kér tőlünk, és van, aki a beköltözés
            előtt az egész lakást végigcsináltatja.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {SPOKE_PAGES.map((spoke) => (
              <Link
                key={spoke.path}
                href={spoke.path}
                className="group rounded-2xl border border-black/10 bg-white p-5 transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
              >
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  {spoke.navLabel}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-black/60">
                  {spoke.navSummary}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand)]">
                  Megnézem
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-black/60">
            Ezeken kívül könyvespolcot, tv-szekrényt, mosógépburkolatot és
            irodabútort is gyártunk. Ha maga állítaná össze a bútort, akkor a{" "}
            <Link
              href="/szolgaltatasok/lapszabaszat-es-elzaras"
              className={INLINE_LINK}
            >
              méretre szabás és az élzárás
            </Link>{" "}
            önmagában is megrendelhető.
          </p>
        </div>
      </section>

      {/* Folyamat */}
      <section id="folyamat" className="scroll-mt-20 border-t border-black/8">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className={H2}>A felméréstől a beépítésig</h2>
          <p className={LEAD}>
            Négy lépés, és mindegyiket mi visszük. Nincs közvetítő, aki
            továbbadja a méreteket, és nincs külsős beépítő, aki először a
            helyszínen látja a bútort.
          </p>

          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-2">
            {SURVEY_STEPS.map((step, i) => (
              <li key={step.title} className="bg-white p-6">
                <span className="text-xs font-semibold tabular-nums text-[var(--color-brand)]">
                  {i + 1}. lépés
                </span>
                <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Anyagok */}
      <section className="border-t border-black/8 bg-stone-wash">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className={H2}>Miből lesz a bútor</h2>
          <p className={LEAD}>
            Nem egy gyártó egy kínálatából választ. A frontanyag, a korpusz, a
            munkalap és a vasalat külön döntés, és ezek mozgatják az árat is.
          </p>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-slate-900">
                Front és korpusz
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-black/65">
                Bútorlapból, illetve festett, fóliás vagy matt frontból. A
                laptárunk online is böngészhető a{" "}
                <Link href="/butorlap" className={INLINE_LINK}>
                  bútorlap katalógusban
                </Link>
                , a különleges frontokat pedig{" "}
                <Link
                  href="/szolgaltatasok/nettfront"
                  className={INLINE_LINK}
                >
                  NettFront partnerként
                </Link>{" "}
                tudjuk hozni.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">Munkalap</dt>
              <dd className="mt-2 text-sm leading-relaxed text-black/65">
                Laminált munkalaptól a kőmintás felületekig. A dekorokat a{" "}
                <Link href="/munkalap" className={INLINE_LINK}>
                  munkalap katalógusban
                </Link>{" "}
                találja, és a kecskeméti bemutatótermünkben kézbe is tudja
                venni őket.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">Vasalat</dt>
              <dd className="mt-2 text-sm leading-relaxed text-black/65">
                Pánt, fiókrendszer, fékezés, sarokmegoldás. Ezen a ponton
                érdemes a legkevésbé spórolni, mert a fiók az, amit naponta
                többször megfog. Raktárról adjuk, így nem a szállítási idő
                dönti el, mi kerül a bútorba.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">
                Mosogató, csaptelep, világítás
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-black/65">
                Az{" "}
                <Link
                  href="/barkacsaruhaz-kecskemet"
                  className={INLINE_LINK}
                >
                  áruházunk készletéből
                </Link>{" "}
                is választhat, de ha már megvette valahol, azt építjük be. A
                gépeknél a típusszámot kérjük, mert a beépítési méret
                gépenként eltér.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Terület */}
      <section className="border-t border-black/8">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className={H2}>Hova járunk ki felmérni</h2>
          <p className={LEAD}>
            A felmérés és a beépítés Budapesten, Pest megyében, Bács-Kiskun
            megyében és a Balaton környékén történik, a gyártás Kecskeméten. A
            két helyszín közötti szállítás a mi dolgunk.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {SURVEY_AREAS.map((area) => (
              <div
                key={area.label}
                className="rounded-2xl border border-black/10 bg-white p-5"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  {area.label}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {area.places.map((place) => (
                    <li
                      key={place}
                      className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs text-black/65"
                    >
                      {place}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-black/60">
            Ha a települését nem találja a listában, hívjon fel minket a{" "}
            <TelClickLink
              href={phoneTel}
              location="hub_areas"
              phoneDisplay={phoneDisplay}
              className={INLINE_LINK}
            >
              {phoneDisplay}
            </TelClickLink>{" "}
            számon.
          </p>
        </div>
      </section>

      {/* GYIK */}
      <section
        id="gyik"
        className="scroll-mt-20 border-t border-black/8 bg-stone-wash"
      >
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className={H2}>Gyakori kérdések</h2>
          <p className={LEAD}>
            Ezeket kérdezik a leggyakrabban az első telefonban.
          </p>
          <div className="mt-8">
            <FaqAccordion items={HUB_FAQ.map((f) => ({ q: f.q, a: f.a }))} />
          </div>
        </div>
      </section>

      {/* Záró CTA */}
      <section className="border-t border-black/8">
        <div className="mx-auto max-w-3xl px-4 py-14 pb-24 text-center sm:px-6 sm:py-16 sm:pb-16">
          <h2 className={H2}>Kezdjük egy felméréssel</h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            Díjmentes, és nem kötelez semmire. A felmérésen kiderül, mi
            valósítható meg a térben, és hogy amit elképzelt, melyik
            árszinthez esik közel.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#felmeres"
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-7 py-3.5 text-base font-semibold text-[var(--color-brand-contrast)] shadow-[0_8px_28px_rgba(151,29,37,0.28)] transition hover:brightness-95 sm:w-auto"
            >
              Kérem a felmérést
            </a>
            <TelClickLink
              href={phoneTel}
              location="hub_cta"
              phoneDisplay={phoneDisplay}
              className="inline-flex w-full items-center justify-center rounded-full border border-black/15 px-7 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-black/[0.03] sm:w-auto"
            >
              {phoneDisplay}
            </TelClickLink>
          </div>
        </div>
      </section>
    </div>
  )
}
