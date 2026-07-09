import type { Metadata } from "next"
import { ClientDetailClient } from "@/components/ugyfelek/client-detail-client"

export const metadata: Metadata = {
  title: "Ügyfél",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function UgyfelekDetailPage({ params }: Props) {
  const { id } = await params
  return <ClientDetailClient clientId={id} />
}
