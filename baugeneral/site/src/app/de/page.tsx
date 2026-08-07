import { StubPageShell } from "@/components/site/StubPageShell"
import { stubPageMetadata } from "@/lib/stub-page"

export const metadata = stubPageMetadata("deHome")

export default function Page() {
  return <StubPageShell routeKey="deHome" />
}

