import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${COMPANY.website}/sitemap.xml`,
    host: COMPANY.website,
  }
}

