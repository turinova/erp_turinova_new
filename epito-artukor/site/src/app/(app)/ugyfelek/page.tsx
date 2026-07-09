import type { Metadata } from "next"
import { ClientsPageClient } from "@/components/ugyfelek/clients-page-client"

export const metadata: Metadata = {
  title: "Ügyfelek",
}

export default function UgyfelekPage() {
  return <ClientsPageClient />
}
