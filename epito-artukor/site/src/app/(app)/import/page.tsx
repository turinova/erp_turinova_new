import type { Metadata } from "next"
import { ImportPageClient } from "@/components/import/import-page-client"

export const metadata: Metadata = {
  title: "Import / Export",
}

export default function ImportPage() {
  return <ImportPageClient />
}
