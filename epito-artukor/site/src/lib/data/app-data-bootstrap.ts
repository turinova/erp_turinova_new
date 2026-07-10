"use client"

import { primeMasterData } from "@/lib/data/master-data-primer"
import {
  isProjectBundleCached,
  syncBundleFromServer,
  syncBundleSummaryFromServer,
} from "@/lib/data/projects-store"
import {
  isProjectFilesCached,
  syncProjectFilesFromServer,
} from "@/lib/data/project-files-store"

export type AppDataBootstrapOptions = {
  /** Teljes projects-bundle — alapértelmezés: igen */
  includeBundle?: boolean
  /** Summary-only bundle (kis payload) — alapértelmezés: igen */
  bundleSummaryOnly?: boolean
  /** Projekt-fájl metaadat — alapértelmezés: nem (lazy, Fájlok tabnál) */
  includeProjectFiles?: boolean
  /** Törzsadat-primer — alapértelmezés: igen */
  includeMasterData?: boolean
  /** K-tételek teljes lista a primerben — alapértelmezés: nem (lazy) */
  includeCostItemsInPrimer?: boolean
  force?: boolean
}

let bootstrapPromise: Promise<void> | null = null
let bootstrapKey = ""

function buildKey(opts: Required<AppDataBootstrapOptions>): string {
  return [
    opts.includeBundle ? (opts.bundleSummaryOnly ? "bs" : "b") : "",
    opts.includeProjectFiles ? "f" : "",
    opts.includeMasterData ? (opts.includeCostItemsInPrimer ? "m" : "m-") : "",
    opts.force ? "!" : "",
  ].join("")
}

/**
 * Egyszeri (session-szintű) app-adat bootstrap.
 * Cache-ben lévő adatot nem tölti újra, hacsak nincs `force`.
 */
export async function bootstrapAppData(
  options: AppDataBootstrapOptions = {}
): Promise<void> {
  const opts: Required<AppDataBootstrapOptions> = {
    includeBundle: options.includeBundle ?? true,
    bundleSummaryOnly: options.bundleSummaryOnly ?? true,
    includeProjectFiles: options.includeProjectFiles ?? false,
    includeMasterData: options.includeMasterData ?? true,
    includeCostItemsInPrimer: options.includeCostItemsInPrimer ?? false,
    force: options.force ?? false,
  }

  const key = buildKey(opts)
  if (!opts.force && bootstrapPromise && bootstrapKey === key) {
    return bootstrapPromise
  }

  bootstrapKey = key
  bootstrapPromise = (async () => {
    const tasks: Promise<unknown>[] = []

    if (opts.includeBundle) {
      if (opts.force || !isProjectBundleCached()) {
        tasks.push(
          opts.bundleSummaryOnly
            ? syncBundleSummaryFromServer({ force: opts.force })
            : syncBundleFromServer({ force: opts.force })
        )
      }
    }

    if (opts.includeProjectFiles) {
      if (opts.force || !isProjectFilesCached()) {
        tasks.push(syncProjectFilesFromServer({ force: opts.force }))
      }
    }

    if (opts.includeMasterData) {
      tasks.push(primeMasterData(opts.force, opts.includeCostItemsInPrimer))
    }

    await Promise.all(tasks)
  })()

  return bootstrapPromise
}

/** Projekt-fájlok lazy betöltése (Fájlok tab). */
export async function ensureProjectFilesLoaded(force = false): Promise<void> {
  if (!force && isProjectFilesCached()) return
  await syncProjectFilesFromServer({ force })
}

export function resetAppDataBootstrap(): void {
  bootstrapPromise = null
  bootstrapKey = ""
}
