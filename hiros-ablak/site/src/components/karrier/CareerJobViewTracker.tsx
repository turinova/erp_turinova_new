"use client"

import { useEffect } from "react"
import { trackCareerJobView } from "@/lib/analytics"

export function CareerJobViewTracker({ jobSlug }: { jobSlug: string }) {
  useEffect(() => {
    trackCareerJobView(jobSlug)
  }, [jobSlug])

  return null
}
