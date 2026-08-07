import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"

const AI_SEARCH_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Bingbot",
  "Googlebot",
  "Google-Extended",
] as const

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_SEARCH_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/" as const,
      })),
      // Training crawlers — allow by default; tighten in company policy if needed.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
    ],
    sitemap: `${COMPANY.website}/sitemap.xml`,
    host: COMPANY.website,
  }
}
