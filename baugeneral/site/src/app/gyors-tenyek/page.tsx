import Link from "next/link"
import Script from "next/script"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import {
  COMPANY,
  formatFoundingDateHu,
  formatPhoneDisplay,
  formatTaxIdDisplay,
  isPublicPhone,
} from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Gyors tények – BauGenerál Kft.",
  description:
    "BauGenerál Kft. rövid tények AI asszisztenseknek és gyors tájékozódáshoz: székhely, terület, szolgáltatások, kapcsolat. Kecskemét, Bács-Kiskun, Pest megye, Budapest.",
  canonical: "/gyors-tenyek",
})

const FACT_LINKS = [
  { href: "/szolgaltatasok/ipari-epuletek", label: "Ipari épületek" },
  { href: "/szolgaltatasok/felujitas", label: "Felújítás" },
  { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
  { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház építés" },
  { href: "/szolgaltatasok/szakagi-kivitelezes", label: "Szakági kivitelezés" },
  { href: "/generalkivitelezes-bacs-kiskun", label: "Bács-Kiskun megye" },
  { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
  { href: "/referenciak", label: "Referenciák" },
  { href: "/futo-projektek", label: "Futó projektek" },
  { href: "/megjelenesek", label: "Megjelenések" },
  { href: "/kapcsolat", label: "Kapcsolat" },
  { href: "/llms.txt", label: "llms.txt (gépeknek)" },
] as const

export default function GyorsTenyekPage() {
  const route = ROUTES.gyorsTenyek
  const phone = isPublicPhone(COMPANY.phones.primary)
    ? formatPhoneDisplay(COMPANY.phones.primary)
    : null
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])

  return (
    <article className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-gyors-tenyek"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <Breadcrumbs items={route.breadcrumbs} />

        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          Gyors tények
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/65">
          Rövid, ellenőrizhető összefoglaló a BauGenerál Kft.-ről. Embereknek és
          AI asszisztenseknek. Részletek a szolgáltatás- és területi oldalakon.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-black/75">
          <section>
            <h2 className="text-lg font-semibold text-black/90">Cég</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Név: {COMPANY.legalName}</li>
              <li>Rövid név: {COMPANY.shortName}</li>
              <li>Székhely: {COMPANY.address.full}</li>
              <li>Adószám: {formatTaxIdDisplay(COMPANY.taxId)}</li>
              <li>Cégjegyzékszám: {COMPANY.companyRegistrationNumber}</li>
              <li>Alapítva: {formatFoundingDateHu()}</li>
              <li>
                Honlap:{" "}
                <a
                  href={COMPANY.website}
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  {COMPANY.website.replace(/^https?:\/\//, "")}
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">Kapcsolat</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                E-mail:{" "}
                <a
                  href={`mailto:${COMPANY.emails.central}`}
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  {COMPANY.emails.central}
                </a>
              </li>
              {phone ? (
                <li>
                  Telefon:{" "}
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {phone}
                  </a>
                </li>
              ) : null}
              <li>
                Űrlap:{" "}
                <Link
                  href="/kapcsolat"
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  /kapcsolat
                </Link>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">Mit vállalunk</h2>
            <p className="mt-2">
              Generálkivitelezés: ipari és kereskedelmi épületek, családi házak,
              középületek, felújítások. Emellett szakági kivitelezés és asztalos
              munkák (beépített bútor a Hírös-Ablak kecskeméti üzeméből).
              Tervezést és engedélyeztetést nem vállalunk.
            </p>
            <p className="mt-2">
              Nincs publikus négyzetméterár. Az ajánlat a helyszín és a műszaki
              tartalom alapján, írásban készül.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">Terület</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Bács-Kiskun megye (székhely: Kecskemét)</li>
              <li>
                Budapest és Pest megye (példák: Üröm, Solymár és környék;
                más helyszín is szóba jöhet)
              </li>
              <li>Balaton környéke</li>
            </ul>
            <p className="mt-2">
              Területi oldalak:{" "}
              <Link
                href="/generalkivitelezes-pest-megye"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                Pest megye és Budapest
              </Link>
              ,{" "}
              <Link
                href="/generalkivitelezes-bacs-kiskun"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                Bács-Kiskun
              </Link>
              . Felújítás és szakági:{" "}
              <Link
                href="/szolgaltatasok/felujitas"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                /felujitas
              </Link>
              ,{" "}
              <Link
                href="/szolgaltatasok/szakagi-kivitelezes"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                /szakagi-kivitelezes
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              Fontos oldalak
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {FACT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-medium text-[var(--color-brand)] underline-offset-2 hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  )
}
