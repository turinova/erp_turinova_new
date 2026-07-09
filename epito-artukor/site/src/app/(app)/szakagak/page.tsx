import type { Metadata } from "next"
import { TradesSettingsClient } from "@/components/beallitasok/trades-settings-client"

export const metadata: Metadata = {
  title: "Szakágak",
}

export default function SzakagakPage() {
  return <TradesSettingsClient />
}
