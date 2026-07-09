import type { Metadata } from "next"
import { CostItemsPageClient } from "@/components/tetelek/cost-items-page-client"

export const metadata: Metadata = {
  title: "Tételek",
}

export default function TetelekPage() {
  return <CostItemsPageClient />
}
