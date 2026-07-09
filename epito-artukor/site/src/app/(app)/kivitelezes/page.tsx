import type { Metadata } from "next"
import { ProjectsPageClient } from "@/components/projektek/projects-page-client"

export const metadata: Metadata = {
  title: "Kivitelezés",
}

export default function KivitelezesPage() {
  return <ProjectsPageClient phase="execution" />
}
