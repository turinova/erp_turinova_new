import Link from "next/link"
import {
  COMPANY,
  formatPhoneDisplay,
  formatTaxIdDisplay,
  isPublicPhone,
} from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.cookie.title,
  description:
    "BauGenerál Kft. cookie tájékoztató: milyen sütiket használunk a baugeneral.hu oldalon.",
  canonical: ROUTES.cookie.path,
})

const UPDATED = "2026. augusztus"

export default function CookieTajekoztatoPage() {
  const phone = isPublicPhone(COMPANY.phones.primary)
    ? formatPhoneDisplay(COMPANY.phones.primary)
    : null

  return (
    <article className="bg-stone-wash">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-medium uppercase tracking-wide text-black/45">
          Jogi tájékoztató
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          Cookie tájékoztató
        </h1>
        <p className="mt-3 text-sm text-black/55">
          Utolsó frissítés: {UPDATED}.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-black/75">
          <section>
            <h2 className="text-lg font-semibold text-black/90">1. Adatkezelő</h2>
            <p className="mt-2">
              A cookie-kkal kapcsolatos tájékoztatást a {COMPANY.legalName} (
              {COMPANY.shortName}) adja.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Székhely: {COMPANY.address.full}</li>
              <li>Adószám: {formatTaxIdDisplay(COMPANY.taxId)}</li>
              <li>
                E-mail:{" "}
                <a
                  href={`mailto:${COMPANY.emails.central}`}
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  {COMPANY.emails.central}
                </a>
              </li>
              {phone ? <li>Telefon: {phone}</li> : null}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              2. Mik azok a cookie-k?
            </h2>
            <p className="mt-2">
              A cookie (süti) kis adatfájl, amelyet a böngésző tárol az Ön
              eszközén. Segíthet a honlap működésében, a beállítások
              megjegyzésében vagy (ha használunk ilyeneket) a látogatottság
              mérésében.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              3. Mit használunk jelenleg?
            </h2>
            <p className="mt-2">
              A {COMPANY.website.replace(/^https?:\/\//, "")} honlap alapvetően
              a működéshez szükséges technikai megoldásokra épül. A honlap a{" "}
              <strong className="font-semibold text-black/85">Vercel</strong>{" "}
              infrastruktúrán fut; a szolgáltató a kiszolgáláshoz technikai
              cookie-kat vagy hasonló azonosítókat használhat (pl. terheléselosztás,
              biztonság).
            </p>
            <p className="mt-2">
              A honlap forgalmát a{" "}
              <strong className="font-semibold text-black/85">
                Vercel Analytics
              </strong>{" "}
              anonim, cookie nélküli méréssel követi (oldalmegtekintések,
              teljesítmény). Ez nem reklámkövető, és nem igényel cookie
              hozzájárulási sávot.
            </p>
            <p className="mt-2">
              Jelenleg nem üzemeltetünk külön marketing cookie-rendszert
              (Google Analytics, Clarity, Facebook Pixel stb.), és nem
              használunk harmadik feles reklámkövetőt a Honlapon. Ha később
              ilyen cookie-alapú analitikát vezetünk be, ezt a tájékoztatót
              frissítjük, és ahol jogszabály előírja, hozzájárulást kérünk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              4. Jogalap
            </h2>
            <p className="mt-2">
              A honlap működéséhez feltétlenül szükséges technikai cookie-k
              jogalapja a szolgáltatás nyújtása / jogos érdek (ePrivacy / GDPR
              szerinti keretek között). Nem szükséges cookie-k esetén – ha
              ilyeneket bevezetünk – az Ön hozzájárulása lesz az irányadó.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              5. Cookie-k kezelése a böngészőben
            </h2>
            <p className="mt-2">
              A legtöbb böngészőben a Beállítások / Adatvédelem menüben
              törölheti, blokkolhatja vagy korlátozhatja a cookie-kat. Ha a
              technikai cookie-kat teljesen kikapcsolja, a Honlap egyes részei
              nem biztos, hogy megfelelően működnek.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              6. Kapcsolódó tájékoztatók
            </h2>
            <p className="mt-2">
              A személyes adatok kezeléséről az{" "}
              <Link
                href="/adatkezelesi-tajekoztato"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                adatkezelési tájékoztató
              </Link>
              , a Honlap használatáról az{" "}
              <Link
                href="/aszf"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                ÁSZF
              </Link>{" "}
              rendelkezik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">7. Módosítás</h2>
            <p className="mt-2">
              Fenntartjuk a jogot, hogy a cookie tájékoztatót frissítsük. A
              hatályos változat mindig ezen az oldalon érhető el.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-black/55">
          <Link
            href="/kapcsolat"
            className="font-medium text-[var(--color-brand)] underline underline-offset-2"
          >
            Vissza a Kapcsolat oldalra
          </Link>
        </p>
      </div>
    </article>
  )
}
