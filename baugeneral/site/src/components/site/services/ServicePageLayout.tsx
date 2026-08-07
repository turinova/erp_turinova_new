import Script from "next/script"
import type { ReactNode } from "react"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { ServiceBand } from "@/components/site/services/ServiceBand"
import { ServiceBottomCta } from "@/components/site/services/ServiceBottomCta"
import { ServiceBuildingTypes } from "@/components/site/services/ServiceBuildingTypes"
import { ServiceFaqSection } from "@/components/site/services/ServiceFaqSection"
import { ServiceHero } from "@/components/site/services/ServiceHero"
import { ServiceProofStrip } from "@/components/site/services/ServiceProofStrip"
import { ServiceScopeProcessSection } from "@/components/site/services/ServiceScopeProcessSection"
import { ServiceWhyAudienceSection } from "@/components/site/services/ServiceWhyAudienceSection"
import {
  buildServiceFaqJsonLd,
  buildServiceJsonLd,
  getServiceByKey,
  getServiceProof,
  getServiceRoute,
  type ServiceKey,
} from "@/lib/services"
import { buildBreadcrumbJsonLd } from "@/lib/seo"

type ServicePageLayoutProps = {
  serviceKey: ServiceKey
  /** Optional block after Why/Audience (e.g. asztalos journey) */
  afterWhy?: ReactNode
  /** Optional block after building types (e.g. partner workshop) */
  afterBuildingTypes?: ReactNode
}

export function ServicePageLayout({
  serviceKey,
  afterWhy,
  afterBuildingTypes,
}: ServicePageLayoutProps) {
  const service = getServiceByKey(serviceKey)
  const route = getServiceRoute(service)
  const proof = getServiceProof(service)
  const proofEarly = service.layoutVariant === "proofEarly"
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])
  const serviceJsonLd = buildServiceJsonLd(service)
  const faqJsonLd = buildServiceFaqJsonLd(service.faq)

  return (
    <div className="bg-white">
      <Script
        id={`jsonld-breadcrumb-service-${serviceKey}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id={`jsonld-service-${serviceKey}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id={`jsonld-faq-service-${serviceKey}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:pt-5">
        <Breadcrumbs items={route.breadcrumbs} />
      </div>

      <ServiceBand tone="white">
        <ServiceHero service={service} />
      </ServiceBand>

      <ServiceBand tone="white">
        <ServiceWhyAudienceSection service={service} />
      </ServiceBand>

      {afterWhy ? <ServiceBand tone="stone">{afterWhy}</ServiceBand> : null}

      <ServiceBand tone={afterWhy ? "white" : "stone"}>
        <ServiceBuildingTypes
          items={service.buildingTypes}
          headings={service.headings}
        />
      </ServiceBand>

      {afterBuildingTypes ? (
        <ServiceBand tone="stone">{afterBuildingTypes}</ServiceBand>
      ) : null}

      {proof && proofEarly ? (
        <ServiceBand tone="stone">
          <ServiceProofStrip proof={proof} headings={service.headings} />
        </ServiceBand>
      ) : null}

      <ServiceBand tone="white">
        <ServiceScopeProcessSection service={service} />
      </ServiceBand>

      {proof && !proofEarly ? (
        <ServiceBand tone="stone">
          <ServiceProofStrip proof={proof} headings={service.headings} />
        </ServiceBand>
      ) : null}

      <ServiceBand tone="white">
        <ServiceFaqSection items={service.faq} headings={service.headings} />
        <ServiceBottomCta service={service} />
      </ServiceBand>
    </div>
  )
}
