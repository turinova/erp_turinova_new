import type { Metadata } from "next"
import { OfferPublicClient } from "@/components/offer/offer-public-client"
import { PublicPageHeader } from "@/components/brand/public-page-header"

export const metadata: Metadata = {
  title: "Projektajánlat",
}

type Props = {
  params: Promise<{ token: string }>
}

export default async function OfferPublicPage({ params }: Props) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PublicPageHeader title="Projektajánlat megtekintése" />
      <OfferPublicClient token={token} />
    </div>
  )
}
