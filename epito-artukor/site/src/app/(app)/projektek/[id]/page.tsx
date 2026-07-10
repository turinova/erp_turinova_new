import type { Metadata } from "next"
import { Suspense } from "react"
import dynamic from "next/dynamic"

const ProjectDetailClient = dynamic(
  () =>
    import("@/components/projektek/project-detail-client").then((m) => m.ProjectDetailClient),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />,
  }
)

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
