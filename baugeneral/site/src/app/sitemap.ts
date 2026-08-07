import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"
import {
  getPressSlugs,
  pressDetailPath,
} from "@/lib/press-appearances"
import {
  activeProjectDetailPath,
  getActiveProjectSlugs,
} from "@/lib/projects"
import { getReferenceSlugs, referenceDetailPath } from "@/lib/references"
import { ROUTES, SITEMAP_ROUTE_KEYS } from "@/lib/routes"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const staticRoutes = SITEMAP_ROUTE_KEYS.map((key) => {
    const route = ROUTES[key]
    return {
      url: `${COMPANY.website}${route.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: key === "home" || key === "enHome" ? 1 : 0.7,
    }
  })

  const referenceRoutes = getReferenceSlugs().map((slug) => ({
    url: `${COMPANY.website}${referenceDetailPath(slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }))

  const activeProjectRoutes = getActiveProjectSlugs().map((slug) => ({
    url: `${COMPANY.website}${activeProjectDetailPath(slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  const pressRoutes = getPressSlugs().map((slug) => ({
    url: `${COMPANY.website}${pressDetailPath(slug)}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }))

  return [
    ...staticRoutes,
    ...referenceRoutes,
    ...activeProjectRoutes,
    ...pressRoutes,
  ]
}
