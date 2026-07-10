"use client"

import { useAppData } from "@/components/shell/app-data-provider"

/**
 * Projekt-munkaterület előkészítése — a layout `AppDataProvider` egyszer
 * betölti a bundle-t és törzsadatokat; oldalváltáskor nem fetch-el újra.
 */
export function useProjectsBundleReady(): boolean {
  const { ready } = useAppData()
  return ready
}
