/**
 * Navigációs bootstrap benchmark — szimulálja az oldalváltás fetch számát.
 *
 * Futtatás: npx tsx scripts/perf-nav-benchmark.ts
 */

type FetchCall = { url: string }

function simulateLegacyNavigation(pages: string[]): FetchCall[] {
  const calls: FetchCall[] = []
  for (const _page of pages) {
    calls.push({ url: "/api/projects-bundle" })
    calls.push({ url: "/api/project-files" })
    // primeMasterData első oldalnál (8 hívás), utána cache
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
      calls.push({ url: "/api/trades" }) // TradesProvider duplikáció
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

function simulateOptimizedNavigation(pages: string[]): FetchCall[] {
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
      // primer cache — nincs extra fetch
    } else if (page === "/projektek/1/files") {
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
]

const legacy = simulateLegacyNavigation(ROUTE_SEQUENCE)
const optimized = simulateOptimizedNavigation([
  ...ROUTE_SEQUENCE.slice(0, 5),
  "/projektek/1/files",
])

function countByUrl(calls: FetchCall[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of calls) {
    out[c.url] = (out[c.url] ?? 0) + 1
  }
  return out
}

const legacyBundle = legacy.filter((c) => c.url === "/api/projects-bundle").length
const optBundle = optimized.filter((c) => c.url === "/api/projects-bundle").length

console.log("=== Építő ártükör — navigációs fetch benchmark (szimuláció) ===\n")
console.log("Útvonal:", ROUTE_SEQUENCE.join(" → "))
console.log("")
console.log("| Metrika | Előtte (legacy) | Utána (optimalizált) |")
console.log("|---------|-----------------|----------------------|")
console.log(`| Összes API hívás | ${legacy.length} | ${optimized.length} |`)
console.log(
  `| projects-bundle hívások | ${legacyBundle} | ${optBundle} |`
)
console.log(
  `| project-files hívások | ${legacy.filter((c) => c.url === "/api/project-files").length} | ${optimized.filter((c) => c.url === "/api/project-files").length} |`
)
console.log(
  `| cost-items hívások | ${legacy.filter((c) => c.url === "/api/cost-items").length} | ${optimized.filter((c) => c.url === "/api/cost-items").length} |`
)

const reduction = Math.round((1 - optimized.length / legacy.length) * 100)
const bundleReduction = Math.round((1 - optBundle / legacyBundle) * 100)

console.log("")
console.log(`Összesített csökkenés: ~${reduction}% kevesebb API hívás`)
console.log(`projects-bundle csökkenés: ~${bundleReduction}%`)

console.log("\n--- Legacy hívások összesen ---")
console.log(countByUrl(legacy))
console.log("\n--- Optimalizált hívások összesen ---")
console.log(countByUrl(optimized))

// Becsült latency (production): bundle ~4s, egyéb ~0.3s
const EST_BUNDLE_MS = 4000
const EST_LIGHT_MS = 300

function estimateMs(calls: FetchCall[]): number {
  let ms = 0
  for (const c of calls) {
    ms += c.url === "/api/projects-bundle" ? EST_BUNDLE_MS : EST_LIGHT_MS
  }
  return ms
}

const legacyMs = estimateMs(legacy)
const optMs = estimateMs(optimized)

console.log("\n--- Becsült production várakozás (4s/bundle, 0.3s/egyéb) ---")
console.log(`Előtte: ~${(legacyMs / 1000).toFixed(1)}s`)
console.log(`Utána:  ~${(optMs / 1000).toFixed(1)}s`)
console.log(`Megtakarítás: ~${((legacyMs - optMs) / 1000).toFixed(1)}s (${Math.round((1 - optMs / legacyMs) * 100)}%)`)
