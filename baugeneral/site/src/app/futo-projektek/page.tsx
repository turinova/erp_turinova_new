import Link from "next/link"
import Script from "next/script"
import { ActiveProjectsGrid } from "@/components/site/projects/ActiveProjectsGrid"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { getActiveProjectCount, getPublishedActiveProjects } from "@/lib/projects"
import { ROUTES } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.futoProjektek.title,
  description: ROUTES.futoProjektek.description,
  canonical: "/futo-projektek",
  ogImage: "/img/rolunk/hero-work.jpg",
})

export default function FutoProjektekPage() {
  const route = ROUTES.futoProjektek
  const projects = getPublishedActiveProjects()
  const count = getActiveProjectCount()
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-futo-projektek"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 md:pb-10">
        <Breadcrumbs items={route.breadcrumbs} />

        <h1 id="futo-projektek-heading" className="about-h1 mt-4">
          Futó projektek
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">
          Jelenleg is építünk — {count} aktív projekt, frissítve ügyfél-jóváhagyással.
          Saját beruházás és megrendelésre készülő munkák.
        </p>

        <div className="mt-5">
          <ActiveProjectsGrid projects={projects} />
        </div>

        <p className="mt-5 text-sm text-black/55">
          Hasonló ütemezésű projektje van?{" "}
          <Link
            href="/kapcsolat"
            className="font-semibold text-[var(--color-brand)] hover:underline"
          >
            Kapcsolatfelvétel →
          </Link>
        </p>
      </div>
    </div>
  )
}
