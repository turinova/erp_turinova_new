"use client"

import { useEffect, useState } from "react"
import { syncBundleFromServer } from "@/lib/data/projects-store"
import { syncProjectFilesFromServer } from "@/lib/data/project-files-store"
import { primeMasterData } from "@/lib/data/master-data-primer"

/**
 * Projekt-munkaterület előkészítése: a projekt-bundle és a törzsadat-cache-ek
 * betöltése a DB-ből. Amíg nem ready, a hívó oldal loading állapotot mutat.
 */
export function useProjectsBundleReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      syncBundleFromServer(),
      syncProjectFilesFromServer(),
      primeMasterData(),
    ]).finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
