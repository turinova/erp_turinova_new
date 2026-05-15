import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument } from "@/components/site/LegalDocument"
import { COMPANY } from "@/lib/company"
import { getPrivacyPolicySections, LEGAL_LAST_UPDATED } from "@/lib/legal-content"

export const metadata: Metadata = {
  title: "Adatkezelési tájékoztató",
  description: `${COMPANY.brand} adatkezelési tájékoztatója. Adatkezelő, jogalapok, érintetti jogok, Vercel hosting, Supabase katalógus, Rackhost domain.`,
  alternates: { canonical: "/adatkezelesi-tajekoztato" },
}

export default function AdatkezelesiTajekoztatoPage() {
  return (
    <LegalDocument
      title="Adatkezelési tájékoztató"
      description={`A ${COMPANY.website} weboldal és a ${COMPANY.shortName} kapcsolattartási, ügyfélszolgálati adatkezelésére vonatkozó tájékoztató. Csak ellenőrizhető, a weboldalon ténylegesen használt adatkezelési tényeket tartalmaz.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={getPrivacyPolicySections()}
    >
      <p className="mt-8 text-sm text-black/65">
        Kapcsolódó dokumentum:{" "}
        <Link
          href="/cookie-tajekoztato"
          className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
        >
          Cookie (süti) tájékoztató
        </Link>
      </p>
    </LegalDocument>
  )
}
