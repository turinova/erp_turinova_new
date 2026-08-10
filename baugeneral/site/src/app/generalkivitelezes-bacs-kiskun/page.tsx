import type { Metadata } from "next"
import { BacsKiskunHub, buildAreaHubMetadata } from "@/components/site/AreaHubPage"

export const metadata: Metadata = buildAreaHubMetadata("bacsKiskun")

export default function BacsKiskunPage() {
  return <BacsKiskunHub />
}
