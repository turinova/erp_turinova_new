import type { Metadata } from "next"
import { Suspense } from "react"
import { ProjectDetailClient } from "@/components/projektek/project-detail-client"

export const metadata: Metadata = {
  title: "Projekt",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <Suspense fallback={<p className="text-slate-500">Betöltés…</p>}>
      <ProjectDetailClient projectId={id} />
    </Suspense>
  )
}
