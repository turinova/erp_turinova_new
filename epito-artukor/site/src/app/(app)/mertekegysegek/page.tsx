import type { Metadata } from "next"
import { UnitsPageClient } from "@/components/mertekegysegek/units-page-client"

export const metadata: Metadata = {
  title: "Mértékegységek",
}

export default function MertekegysegekPage() {
  return <UnitsPageClient />
}
