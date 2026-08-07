import { ServicePageLayout } from "@/components/site/services/ServicePageLayout"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.felujitas.title,
  description: ROUTES.felujitas.description,
  canonical: ROUTES.felujitas.path,
  ogImage: ROUTES.felujitas.heroImage,
})

export default function Page() {
  return <ServicePageLayout serviceKey="felujitas" />
}
