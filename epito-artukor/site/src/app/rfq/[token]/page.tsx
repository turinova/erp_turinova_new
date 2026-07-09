import type { Metadata } from "next"
import { PublicPageHeader } from "@/components/brand/public-page-header"
import { RfqPublicClient } from "@/components/rfq/rfq-public-client"

export const metadata: Metadata = {
  title: "Alvállalkozói ajánlat beküldése",
}

type Props = {
  params: Promise<{ token: string }>
}

export default async function RfqPublicPage({ params }: Props) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PublicPageHeader title="Alvállalkozói ajánlat beküldése" />
      <RfqPublicClient token={token} />
    </div>
  )
}
