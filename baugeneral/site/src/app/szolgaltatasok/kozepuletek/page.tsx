import { ServicePageLayout } from "@/components/site/services/ServicePageLayout"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.kozepuletek.title,
  description: ROUTES.kozepuletek.description,
  canonical: ROUTES.kozepuletek.path,
  ogImage: ROUTES.kozepuletek.heroImage,
})

export default function Page() {
  return <ServicePageLayout serviceKey="kozepuletek" />
}
