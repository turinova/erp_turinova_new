import type { Metadata } from "next"
import { PestMegyeHub, buildAreaHubMetadata } from "@/components/site/AreaHubPage"

export const metadata: Metadata = buildAreaHubMetadata("pestMegye")

export default function PestMegyePage() {
  return <PestMegyeHub />
}
