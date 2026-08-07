import { ServicePageLayout } from "@/components/site/services/ServicePageLayout"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.csaladiHaz.title,
  description: ROUTES.csaladiHaz.description,
  canonical: ROUTES.csaladiHaz.path,
  ogImage: ROUTES.csaladiHaz.heroImage,
})

export default function Page() {
  return <ServicePageLayout serviceKey="csaladiHaz" />
}
