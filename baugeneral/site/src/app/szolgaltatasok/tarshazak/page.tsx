import { ServicePageLayout } from "@/components/site/services/ServicePageLayout"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.tarshazak.title,
  description: ROUTES.tarshazak.description,
  canonical: ROUTES.tarshazak.path,
  ogImage: ROUTES.tarshazak.heroImage,
})

export default function Page() {
  return <ServicePageLayout serviceKey="tarshazak" />
}
