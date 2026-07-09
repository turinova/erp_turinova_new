import type { Metadata } from "next"
import { SubcontractorsPageClient } from "@/components/alvalalkozok/subcontractors-page-client"

export const metadata: Metadata = {
  title: "Alvállalkozók",
}

export default function AlvalalkozokPage() {
  return <SubcontractorsPageClient />
}
