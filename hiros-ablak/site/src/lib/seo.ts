import type { Metadata } from "next"
import { COMPANY } from "@/lib/company"

/** Default social share image (1200×630), absolute URL for meta tags. */
export const DEFAULT_OG_IMAGE_PATH = "/og/og-default.png"
export const DEFAULT_OG_IMAGE = `${COMPANY.website}${DEFAULT_OG_IMAGE_PATH}`

export const ORGANIZATION_ID = `${COMPANY.website}/#organization`
export const LOCAL_BUSINESS_ID = `${COMPANY.website}/#localbusiness`
export const WEBSITE_ID = `${COMPANY.website}/#website`

/** Preview / local builds should not compete with production in search. */
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

export function defaultOpenGraph(
  path: string,
  opts?: { title?: string; description?: string; image?: string },
): Metadata["openGraph"] {
  return {
    type: "website",
    url: path,
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
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.canonical },
    robots: input.robots ?? getDefaultRobots(),
    openGraph: defaultOpenGraph(input.canonical, {
      title: input.title,
      description: input.description,
      image: input.ogImage,
    }),
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [input.ogImage ?? DEFAULT_OG_IMAGE],
    },
  }
}
