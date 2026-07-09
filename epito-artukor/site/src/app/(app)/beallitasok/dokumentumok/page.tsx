import type { Metadata } from "next"
import { DocumentSettingsClient } from "@/components/beallitasok/document-settings-client"

export const metadata: Metadata = {
  title: "Dokumentumok",
}

export default function DocumentSettingsPage() {
  return <DocumentSettingsClient />
}
