import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import { ProjectDetailContent } from "@/components/site/projects/ProjectDetailContent"
import { ProjectDetailGallery } from "@/components/site/projects/ProjectDetailGallery"
import { ProjectDetailHeader } from "@/components/site/projects/ProjectDetailHeader"
import { ProjectFactsStrip } from "@/components/site/projects/ProjectFactsStrip"
import { ProjectPhaseCard } from "@/components/site/projects/ProjectPhaseCard"
import { ProjectThumbCard } from "@/components/site/projects/ProjectDetailParts"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { COMPANY } from "@/lib/company"
import { getProjectTimelineState, toTimelineISODate } from "@/lib/project-timeline"
import {
  activeProjectDetailPath,
  getActiveProjectBySlug,
  getActiveProjectSlugs,
  getProjectDetailImages,
  getProjectFactRows,
  getRelatedActiveProjects,
  PROJECT_CATEGORY_LABELS,
  PROJECT_OWNERSHIP_LABELS,
  PROJECT_PHASE_LABELS,
  type ActiveProject,
} from "@/lib/projects"
import { absoluteUrl, buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getActiveProjectSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const project = getActiveProjectBySlug(slug)
  if (!project) return {}

  const today = toTimelineISODate(new Date())

  return pageMetadata({
    title: project.title,
    description: project.tldr,
    canonical: activeProjectDetailPath(slug),
    ogImage: project.heroImage.src,
    modified: today,
  })
}

function buildActiveProjectJsonLd(project: ActiveProject) {
  const timeline = getProjectTimelineState(project)
  const today = toTimelineISODate(timeline.today)

  return {
    "@context": "https://schema.org",
    "@type": "Project",
    name: project.title,
    description: project.tldr,
    dateModified: today,
    startDate: project.startedAt,
    endDate: project.expectedCompletion,
    projectStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: project.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: project.city,
        addressCountry: "HU",
      },
    },
    creator: {
      "@type": "Organization",
      name: COMPANY.shortName,
      url: COMPANY.website,
    },
    image: absoluteUrl(project.heroImage.src),
    url: absoluteUrl(activeProjectDetailPath(project.slug)),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Beruházás",
        value: PROJECT_OWNERSHIP_LABELS[project.ownership],
      },
      {
        "@type": "PropertyValue",
        name: "Típus",
        value: PROJECT_CATEGORY_LABELS[project.category],
      },
      {
        "@type": "PropertyValue",
        name: "Aktuális fázis",
        value: PROJECT_PHASE_LABELS[timeline.phase],
      },
    ],
  }
}

export default async function ActiveProjectDetailPage({ params }: PageProps) {
  const { slug } = await params
  const project = getActiveProjectBySlug(slug)
  if (!project) notFound()

  const related = getRelatedActiveProjects(project)
  const breadcrumbs = [
    { name: "Főoldal", path: "/" },
    { name: "Futó projektek", path: "/futo-projektek" },
    { name: project.title, path: activeProjectDetailPath(project.slug) },
  ]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbs)
  const projectJsonLd = buildActiveProjectJsonLd(project)
  const images = getProjectDetailImages(project)
  const facts = getProjectFactRows(project)

  return (
    <div className="bg-stone-wash">
      <Script
        id={`jsonld-breadcrumb-project-${project.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id={`jsonld-project-${project.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />

      <div className="mx-auto max-w-6xl space-y-4 px-4 pb-10 pt-4 md:space-y-5 md:pb-12">
        <Breadcrumbs items={breadcrumbs} />

        <ProjectDetailHeader project={project} />

        <ProjectDetailGallery images={images} />

        <ProjectFactsStrip facts={facts} />

        <ProjectPhaseCard
          startedAt={project.startedAt}
          expectedCompletion={project.expectedCompletion}
          currentPhase={project.currentPhase}
        />

        <ProjectDetailContent project={project} />

        {related.length > 0 ? (
          <section
            aria-labelledby="related-projects-heading"
            className="rounded-[var(--radius-md)] border border-black/8 bg-white px-5 py-5 md:px-6 md:py-6"
          >
            <h2
              id="related-projects-heading"
              className="text-base font-semibold text-black/70"
            >
              További futó projektek
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {related.map((item) => (
                <li key={item.slug}>
                  <ProjectThumbCard project={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-base text-black/60">
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
