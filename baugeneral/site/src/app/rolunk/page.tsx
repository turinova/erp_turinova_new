import Script from "next/script"
import { AboutProfile } from "@/components/site/about/AboutProfile"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { ABOUT_OG_IMAGE } from "@/lib/about-data"
import { buildOrganizationJsonLd, COMPANY } from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.rolunk.title,
  description: COMPANY.entityDefinitionHu,
  canonical: "/rolunk",
  ogImage: ABOUT_OG_IMAGE,
})

export default function RolunkPage() {
  const route = ROUTES.rolunk
  const organizationJsonLd = buildOrganizationJsonLd()
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-organization-rolunk"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Script
        id="jsonld-breadcrumb-rolunk-page"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:pt-5">
        <Breadcrumbs items={route.breadcrumbs} />
      </div>

      <AboutProfile />
    </div>
  )
}
