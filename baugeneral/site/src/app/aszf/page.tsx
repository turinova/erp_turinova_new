import { StubPageShell } from "@/components/site/StubPageShell"
import { stubPageMetadata } from "@/lib/stub-page"

export const metadata = stubPageMetadata("aszf")

export default function Page() {
  return <StubPageShell routeKey="aszf" />
}
