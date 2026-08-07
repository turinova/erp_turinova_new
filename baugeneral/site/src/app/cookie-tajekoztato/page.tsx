import { StubPageShell } from "@/components/site/StubPageShell"
import { stubPageMetadata } from "@/lib/stub-page"

export const metadata = stubPageMetadata("cookie")

export default function Page() {
  return <StubPageShell routeKey="cookie" />
}
