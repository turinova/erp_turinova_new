import type { Metadata } from "next"
import { SubcontractorDetailClient } from "@/components/alvalalkozok/subcontractor-detail-client"

export const metadata: Metadata = {
  title: "Alvállalkozó",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function AlvalalkozokDetailPage({ params }: Props) {
  const { id } = await params
  return <SubcontractorDetailClient subcontractorId={id} />
}
