import type { Metadata } from "next"
import { ProjectsPageClient } from "@/components/projektek/projects-page-client"

export const metadata: Metadata = {
  title: "Árajánlatok",
}

export default function AjanlatokPage() {
  return <ProjectsPageClient phase="quotes" />
}
