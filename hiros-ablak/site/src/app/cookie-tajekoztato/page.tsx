import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument } from "@/components/site/LegalDocument"
import { COMPANY } from "@/lib/company"
import { getCookiePolicySections, LEGAL_LAST_UPDATED } from "@/lib/legal-content"

export const metadata: Metadata = {
  title: "Cookie (süti) tájékoztató",
  description: `${COMPANY.brand} weboldal süti (cookie) tájékoztatója. Süti kategóriák, hozzájárulás, Trustindex és technikai szolgáltatók.`,
  alternates: { canonical: "/cookie-tajekoztato" },
}

export default function CookieTajekoztatoPage() {
  return (
    <LegalDocument
      title="Cookie (süti) tájékoztató"
      description={`A ${COMPANY.website} weboldal süti-kezelésére vonatkozó tájékoztató. Kizárólag az ezen az oldalon ténylegesen használt technológiák és szolgáltatók szerepelnek benne.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={getCookiePolicySections()}
    >
      <p className="mt-8 text-sm text-black/65">
        Kapcsolódó dokumentum:{" "}
        <Link
          href="/adatkezelesi-tajekoztato"
          className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
        >
          Adatkezelési tájékoztató
        </Link>
      </p>
    </LegalDocument>
  )
}
