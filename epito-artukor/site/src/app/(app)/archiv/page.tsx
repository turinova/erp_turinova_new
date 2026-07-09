import type { Metadata } from "next"
import { ProjectsPageClient } from "@/components/projektek/projects-page-client"

export const metadata: Metadata = {
  title: "Archív",
}

export default function ArchivPage() {
  return <ProjectsPageClient phase="archive" />
}
