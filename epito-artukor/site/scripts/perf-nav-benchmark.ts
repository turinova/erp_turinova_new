/**
 * Navigációs bootstrap benchmark — szimulálja az oldalváltás fetch számát.
 *
 * Futtatás: npm run perf:bench
 */

type FetchCall = { url: string }

const EST_BUNDLE_MS = 4000
const EST_SUMMARY_MS = 1200
const EST_PROJECT_BUNDLE_MS = 900
const EST_LIGHT_MS = 300
const EST_COST_ITEMS_FULL_MS = 2500
const EST_COST_ITEMS_PAGE_MS = 400

function estimateMs(calls: FetchCall[]): number {
  let ms = 0
  for (const c of calls) {
    if (c.url === "/api/projects-bundle") ms += EST_BUNDLE_MS
    else if (c.url === "/api/projects/summary") ms += EST_SUMMARY_MS
    else if (c.url.includes("/bundle")) ms += EST_PROJECT_BUNDLE_MS
    else if (c.url === "/api/cost-items") ms += EST_COST_ITEMS_FULL_MS
    else if (c.url.startsWith("/api/cost-items?")) ms += EST_COST_ITEMS_PAGE_MS
    else ms += EST_LIGHT_MS
  }
  return ms
}

function simulateLegacyNavigation(pages: string[]): FetchCall[] {
  const calls: FetchCall[] = []
  for (const _page of pages) {
    calls.push({ url: "/api/projects-bundle" })
    calls.push({ url: "/api/project-files" })
    if (calls.filter((c) => c.url === "/api/cost-items").length === 0) {
      for (const url of [
        "/api/cost-items",
        "/api/subcontractors",
        "/api/clients",
        "/api/units",
        "/api/categories",
        "/api/app-settings",
        "/api/organization",
        "/api/trades",
      ]) {
        calls.push({ url })
      }
      calls.push({ url: "/api/trades" })
    }
    if (_page === "/ugyfelek") {
      calls.push({ url: "/api/clients" })
    }
    if (_page === "/alvalalkozok") {
      calls.push({ url: "/api/subcontractors" })
    }
    if (_page === "/tetelek") {
      calls.push({ url: "/api/cost-items" })
      calls.push({ url: "/api/categories" })
      calls.push({ url: "/api/units" })
    }
  }
  return calls
}

function simulatePhase1Navigation(pages: string[]): FetchCall[] {
  const calls: FetchCall[] = []
  let bundleLoaded = false
  let masterPrimed = false
  let tradesLoaded = false

  const primeOnce = () => {
    if (masterPrimed) return
    masterPrimed = true
    for (const url of [
      "/api/cost-items",
      "/api/subcontractors",
      "/api/clients",
      "/api/units",
      "/api/categories",
      "/api/app-settings",
      "/api/organization",
    ]) {
      calls.push({ url })
    }
    if (!tradesLoaded) {
      calls.push({ url: "/api/trades" })
      tradesLoaded = true
    }
  }

  for (const page of pages) {
    if (!bundleLoaded) {
      calls.push({ url: "/api/projects-bundle" })
      bundleLoaded = true
      primeOnce()
    }

    if (page === "/ugyfelek") {
      calls.push({ url: "/api/clients" })
      calls.push({ url: "/api/clients/project-counts" })
    } else if (page === "/alvalalkozok") {
      calls.push({ url: "/api/subcontractors" })
      calls.push({ url: "/api/subcontractors/rfq-stats" })
    } else if (page === "/tetelek") {
      // primer cache
    } else if (page === "/projektek/1/files") {
      calls.push({ url: "/api/project-files" })
    }
  }

  return calls
}

function simulatePhase2Navigation(pages: string[]): FetchCall[] {
  const calls: FetchCall[] = []
  let summaryLoaded = false
  let masterPrimed = false
  let tradesLoaded = false
  const loadedProjects = new Set<string>()

  const primeOnce = () => {
    if (masterPrimed) return
    masterPrimed = true
    for (const url of [
      "/api/subcontractors",
      "/api/clients",
      "/api/units",
      "/api/categories",
      "/api/app-settings",
      "/api/organization",
    ]) {
      calls.push({ url })
    }
    if (!tradesLoaded) {
      calls.push({ url: "/api/trades" })
      tradesLoaded = true
    }
  }

  for (const page of pages) {
    if (!summaryLoaded) {
      calls.push({ url: "/api/projects/summary" })
      summaryLoaded = true
      primeOnce()
    }

    const projectMatch = page.match(/^\/projektek\/([^/]+)/)
    if (projectMatch) {
      const projectId = projectMatch[1]
      if (!loadedProjects.has(projectId)) {
        calls.push({ url: `/api/projects/${projectId}/bundle` })
        loadedProjects.add(projectId)
      }
      if (page.includes("/ajanlat/")) {
        calls.push({ url: "/api/cost-items" })
      }
    }

    if (page === "/ugyfelek") {
      calls.push({ url: "/api/clients" })
      calls.push({ url: "/api/clients/project-counts" })
    } else if (page === "/alvalalkozok") {
      calls.push({ url: "/api/subcontractors" })
      calls.push({ url: "/api/subcontractors/rfq-stats" })
    } else if (page === "/tetelek") {
      calls.push({ url: "/api/cost-items?page=1&pageSize=50" })
    } else if (page.endsWith("/files")) {
      calls.push({ url: "/api/project-files" })
    }
  }

  return calls
}

const ROUTE_SEQUENCE = [
  "/ajanlatok",
  "/ugyfelek",
  "/alvalalkozok",
  "/tetelek",
  "/ajanlatok",
  "/projektek/1",
  "/projektek/1/ajanlat/q1",
]

const legacy = simulateLegacyNavigation(ROUTE_SEQUENCE)
const phase1 = simulatePhase1Navigation([
  ...ROUTE_SEQUENCE.slice(0, 5),
  "/projektek/1/files",
])
const phase2 = simulatePhase2Navigation(ROUTE_SEQUENCE)

function countByUrl(calls: FetchCall[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of calls) {
    const key = c.url.split("?")[0]
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

function countHeavyBundle(calls: FetchCall[]): number {
  return calls.filter((c) => c.url === "/api/projects-bundle").length
}

function countSummary(calls: FetchCall[]): number {
  return calls.filter((c) => c.url === "/api/projects/summary").length
}

function countProjectBundles(calls: FetchCall[]): number {
  return calls.filter((c) => c.url.startsWith("/api/projects/") && c.url.endsWith("/bundle")).length
}

console.log("=== Építő ártükör — navigációs fetch benchmark (szimuláció) ===\n")
console.log("Útvonal:", ROUTE_SEQUENCE.join(" → "))
console.log("")
console.log("| Metrika | Legacy | Phase 1 | Phase 2 |")
console.log("|---------|--------|---------|---------|")
console.log(`| Összes API hívás | ${legacy.length} | ${phase1.length} | ${phase2.length} |`)
console.log(
  `| Teljes projects-bundle | ${countHeavyBundle(legacy)} | ${countHeavyBundle(phase1)} | ${countHeavyBundle(phase2)} |`
)
console.log(
  `| projects/summary | ${countSummary(legacy)} | ${countSummary(phase1)} | ${countSummary(phase2)} |`
)
console.log(
  `| Per-project bundle | ${countProjectBundles(legacy)} | ${countProjectBundles(phase1)} | ${countProjectBundles(phase2)} |`
)
console.log(
  `| cost-items (teljes lista) | ${legacy.filter((c) => c.url === "/api/cost-items").length} | ${phase1.filter((c) => c.url === "/api/cost-items").length} | ${phase2.filter((c) => c.url === "/api/cost-items").length} |`
)

const legacyMs = estimateMs(legacy)
const phase1Ms = estimateMs(phase1)
const phase2Ms = estimateMs(phase2)

console.log("")
console.log("--- Becsült production várakozás ---")
console.log(`Legacy:  ~${(legacyMs / 1000).toFixed(1)}s`)
console.log(`Phase 1: ~${(phase1Ms / 1000).toFixed(1)}s (${Math.round((1 - phase1Ms / legacyMs) * 100)}% javulás)`)
console.log(
  `Phase 2: ~${(phase2Ms / 1000).toFixed(1)}s (${Math.round((1 - phase2Ms / legacyMs) * 100)}% javulás vs legacy, ${Math.round((1 - phase2Ms / phase1Ms) * 100)}% vs phase 1)`
)

console.log("\n--- Legacy ---")
console.log(countByUrl(legacy))
console.log("\n--- Phase 1 ---")
console.log(countByUrl(phase1))
console.log("\n--- Phase 2 ---")
console.log(countByUrl(phase2))
