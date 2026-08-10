import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { ROUTES, type RouteKey } from "@/lib/routes"

export function stubPageMetadata(key: RouteKey): Metadata {
  const route = ROUTES[key]
  return pageMetadata({
    title: route.title,
    description: route.description,
    canonical: route.path,
    locale: route.locale,
    // EN/DE (and any remaining stubs) stay out of the index until real content ships.
    robots: { index: false, follow: false },
  })
}
