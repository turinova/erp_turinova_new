"use client"

import type { Category, CostItem, Unit } from "@/types"
import type { Client } from "@/types/clients"
import type { Subcontractor } from "@/types/subcontractors"
import type { AppSettings } from "@/types/app-settings"
import type { OrganizationProfile } from "@/types/organization"
import type { TradeRecord } from "@/types/trade"
import { setCostItemsCache } from "@/lib/data/cost-items-store"
import { setSubcontractorsCache } from "@/lib/data/subcontractors-store"
import { setClientsCache } from "@/lib/data/clients-store"
import { setUnitsCache } from "@/lib/data/units-store"
import { setCategoriesCache } from "@/lib/data/categories-store"
import { cacheAppSettings } from "@/lib/data/app-settings-store"
import { cacheOrganizationProfile } from "@/lib/data/org-store"
import { saveTrades } from "@/lib/data/trades-store"
import { setCachedTrades } from "@/lib/trades/trades-cache"

/**
 * Törzsadat-primer: a DB-s API-król tölti fel a szinkron olvasásra használt
 * in-memory cache-eket (ártükör, alvállalkozók, ügyfelek, mértékegységek,
 * beállítások, cégprofil, szakágak). A projekt-domain oldalai a
 * useProjectsBundleReady hookon keresztül várják be.
 */

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

let primePromise: Promise<void> | null = null

async function primeAll(): Promise<void> {
  await Promise.all([
    fetchJson<{ items?: CostItem[] }>("/api/cost-items").then((d) => {
      if (d?.items) setCostItemsCache(d.items)
    }),
    fetchJson<{ subcontractors?: Subcontractor[] }>("/api/subcontractors").then((d) => {
      if (d?.subcontractors) setSubcontractorsCache(d.subcontractors)
    }),
    fetchJson<{ clients?: Client[] }>("/api/clients").then((d) => {
      if (d?.clients) setClientsCache(d.clients)
    }),
    fetchJson<{ units?: Unit[] }>("/api/units").then((d) => {
      if (d?.units) setUnitsCache(d.units)
    }),
    fetchJson<{ categories?: Category[] }>("/api/categories").then((d) => {
      if (d?.categories) setCategoriesCache(d.categories)
    }),
    fetchJson<{ settings?: AppSettings }>("/api/app-settings").then((d) => {
      if (d?.settings) cacheAppSettings(d.settings)
    }),
    fetchJson<{ profile?: OrganizationProfile }>("/api/organization").then((d) => {
      if (d?.profile) cacheOrganizationProfile(d.profile)
    }),
    fetchJson<{ trades?: TradeRecord[] }>("/api/trades").then((d) => {
      if (d?.trades) {
        saveTrades(d.trades)
        setCachedTrades(d.trades)
      }
    }),
  ])
}

/** Egyszer fut sessiononként; a `force` újratöltést kényszerít. */
export function primeMasterData(force = false): Promise<void> {
  if (force || !primePromise) {
    primePromise = primeAll()
  }
  return primePromise
}
