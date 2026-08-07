import { ServicePageLayout } from "@/components/site/services/ServicePageLayout"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.ipari.title,
  description: ROUTES.ipari.description,
  canonical: ROUTES.ipari.path,
  ogImage: ROUTES.ipari.heroImage,
})

export default function IpariEpuletekPage() {
  return <ServicePageLayout serviceKey="ipari" />
}
