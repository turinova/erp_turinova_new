import type { Metadata } from "next"
import { CompanySettingsClient } from "@/components/beallitasok/company-settings-client"

export const metadata: Metadata = {
  title: "Saját cég",
}

export default function CompanySettingsPage() {
  return <CompanySettingsClient />
}
