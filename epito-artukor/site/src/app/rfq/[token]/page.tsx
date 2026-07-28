import type { Metadata } from "next"
import { PublicPageHeader } from "@/components/brand/public-page-header"
import { RfqPublicClient } from "@/components/rfq/rfq-public-client"

export const metadata: Metadata = {
  title: "Alvállalkozói felület",
}

type Props = {
  params: Promise<{ token: string }>
}

export default async function RfqPublicPage({ params }: Props) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PublicPageHeader title="Alvállalkozói felület" />
      <RfqPublicClient token={token} />
    </div>
  )
}
