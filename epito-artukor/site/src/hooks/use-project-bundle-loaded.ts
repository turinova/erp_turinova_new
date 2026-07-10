"use client"

import { useEffect, useState } from "react"
import { useAppData } from "@/components/shell/app-data-provider"
import {
  ensureProjectBundleLoaded,
  isProjectDetailLoaded,
} from "@/lib/data/projects-store"

/** Projekt részletes bundle betöltve-e (lazy fetch után). */
export function useProjectBundleLoaded(projectId: string): boolean {
  const { ready } = useAppData()
  const [loaded, setLoaded] = useState(() => isProjectDetailLoaded(projectId))

  useEffect(() => {
    if (!ready) return
    if (isProjectDetailLoaded(projectId)) {
      setLoaded(true)
      return
    }
    let cancelled = false
    void ensureProjectBundleLoaded(projectId).then((ok) => {
      if (!cancelled) setLoaded(ok)
    })
    return () => {
      cancelled = true
    }
  }, [ready, projectId])

  return ready && loaded
}
