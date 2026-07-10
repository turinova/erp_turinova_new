"use client"

import { primeMasterData } from "@/lib/data/master-data-primer"
import {
  isProjectBundleCached,
  syncBundleFromServer,
} from "@/lib/data/projects-store"
import {
  isProjectFilesCached,
  syncProjectFilesFromServer,
} from "@/lib/data/project-files-store"

export type AppDataBootstrapOptions = {
  /** Teljes projects-bundle — alapértelmezés: igen */
  includeBundle?: boolean
  /** Projekt-fájl metaadat — alapértelmezés: nem (lazy, Fájlok tabnál) */
  includeProjectFiles?: boolean
  /** Törzsadat-primer — alapértelmezés: igen */
  includeMasterData?: boolean
  force?: boolean
}

let bootstrapPromise: Promise<void> | null = null
let bootstrapKey = ""

function buildKey(opts: Required<AppDataBootstrapOptions>): string {
  return [
    opts.includeBundle ? "b" : "",
    opts.includeProjectFiles ? "f" : "",
    opts.includeMasterData ? "m" : "",
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
    includeProjectFiles: options.includeProjectFiles ?? false,
    includeMasterData: options.includeMasterData ?? true,
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
        tasks.push(syncBundleFromServer({ force: opts.force }))
      }
    }

    if (opts.includeProjectFiles) {
      if (opts.force || !isProjectFilesCached()) {
        tasks.push(syncProjectFilesFromServer({ force: opts.force }))
      }
    }

    if (opts.includeMasterData) {
      tasks.push(primeMasterData(opts.force))
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
