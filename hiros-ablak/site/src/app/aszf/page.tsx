import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument } from "@/components/site/LegalDocument"
import { COMPANY, formatPhoneDisplay } from "@/lib/company"

export const metadata: Metadata = {
  title: "Általános szerződési feltételek",
  description: `${COMPANY.brand} általános szerződési feltételei.`,
  alternates: { canonical: "/aszf" },
}

export default function AszfPage() {
  return (
    <LegalDocument
      title="Általános szerződési feltételek (ÁSZF)"
      description="Az ÁSZF szövege jelenleg frissítés alatt áll. Üzleti feltételekről telefonon vagy e-mailben adunk tájékoztatást."
      lastUpdated="2026. május 15."
      sections={[
        {
          id: "statusz",
          title: "Tájékoztatás",
          paragraphs: [
            `A ${COMPANY.shortName} általános szerződési feltételeinek végleges szövege ezen a weboldalon még nem került közzétételre.`,
            "Vásárlás, lapszabászat vagy egyedi megrendelés előtt kérjük, vegye fel velünk a kapcsolatot; az aktuális feltételeket az adott megrendeléshez igazítva egyeztetjük.",
          ],
        },
        {
          id: "kapcsolat",
          title: "Kapcsolat",
          list: [
            `E-mail: ${COMPANY.emails.central}`,
            `Telefon: ${formatPhoneDisplay(COMPANY.phones.primary)}`,
            `Cím: ${COMPANY.address.full}`,
          ],
        },
      ]}
    >
      <p className="mt-8 text-sm text-black/65">
        <Link
          href="/adatkezelesi-tajekoztato"
          className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
        >
          Adatkezelési tájékoztató
        </Link>
        {" · "}
        <Link
          href="/cookie-tajekoztato"
          className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
        >
          Cookie tájékoztató
        </Link>
      </p>
    </LegalDocument>
  )
}
