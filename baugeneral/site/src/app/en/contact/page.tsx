import { StubPageShell } from "@/components/site/StubPageShell"
import { stubPageMetadata } from "@/lib/stub-page"

export const metadata = stubPageMetadata("enContact")

export default function Page() {
  return <StubPageShell routeKey="enContact" />
}
