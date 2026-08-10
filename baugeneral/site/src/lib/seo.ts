import type { Metadata } from "next"
import { COMPANY } from "@/lib/company"

/** App Router `opengraph-image.tsx` — PNG, social-platform friendly */
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image"
export const DEFAULT_OG_IMAGE = `${COMPANY.website}${DEFAULT_OG_IMAGE_PATH}`

export function getDefaultRobots(): NonNullable<Metadata["robots"]> {
  if (process.env.VERCEL_ENV === "preview") {
    return { index: false, follow: false }
  }
  if (process.env.NODE_ENV === "development") {
    return { index: false, follow: false }
  }
  return { index: true, follow: true }
}

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path
  return `${COMPANY.website}${path.startsWith("/") ? path : `/${path}`}`
}

export type BreadcrumbItem = { name: string; path: string }

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${COMPANY.website}/#website`,
    name: COMPANY.brand,
    alternateName: COMPANY.shortName,
    url: COMPANY.website,
    inLanguage: "hu-HU",
    publisher: { "@id": `${COMPANY.website}/#organization` },
  }
}

export function defaultOpenGraph(
  path: string,
  opts?: { title?: string; description?: string; image?: string },
): Metadata["openGraph"] {
  return {
    type: "website",
    url: absoluteUrl(path),
    siteName: COMPANY.brand,
    locale: "hu_HU",
    title: opts?.title,
    description: opts?.description,
    images: [
      {
        url: opts?.image ?? DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: COMPANY.brand,
      },
    ],
  }
}

export function pageMetadata(input: {
  title: string
  description: string
  canonical: string
  ogImage?: string
  robots?: Metadata["robots"]
  locale?: "hu" | "en" | "de"
  /** ISO dátum — futó projektek dateModified */
  modified?: string
}): Metadata {
  // Short title only — root layout `title.template` appends `| BauGenerál`.
  const title = input.title
  const socialTitle = `${input.title} | ${COMPANY.brand}`

  return {
    title,
    description: input.description,
    alternates: { canonical: input.canonical },
    robots: input.robots ?? getDefaultRobots(),
    ...(input.modified ? { other: { "article:modified_time": input.modified } } : {}),
    openGraph: defaultOpenGraph(input.canonical, {
      title: socialTitle,
      description: input.description,
      image: input.ogImage,
    }),
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
      images: [input.ogImage ?? DEFAULT_OG_IMAGE],
    },
  }
}
