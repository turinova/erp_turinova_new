import type { SupabaseClient } from "@supabase/supabase-js"
import type { Catalyst, CatalystSeverity } from "./types"

/**
 * Hír / katalizátor réteg.
 * Elsődleges: CryptoPanic public API (opcionális tokennel).
 * Másodlagos: manuális bejegyzések a crypto_news táblában.
 */

const HIGH_DOGE = [/elon/i, /musk/i, /spacex/i, /x money/i, /doge-?1/i, /dogecoin/i]
const HIGH_SOL = [/outage/i, /\bhalt\b/i, /\betf\b/i, /alpenglow/i, /simd/i, /solana.*down/i]
const MED_BTC = [/\bfed\b/i, /\bcpi\b/i, /\bsec\b/i, /rate cut/i, /fomc/i]

export function scoreNews(
  title: string,
  currencies: string[]
): { severity: CatalystSeverity; tags: string[]; symbols: string[] } {
  const tags: string[] = []
  const symbols = new Set<string>()
  let severity: CatalystSeverity = "low"

  const bump = (s: CatalystSeverity) => {
    const rank = { low: 0, med: 1, high: 2 }
    if (rank[s] > rank[severity]) severity = s
  }

  for (const c of currencies) {
    const u = c.toUpperCase()
    if (u === "SOL" || u === "DOGE" || u === "BTC" || u === "ETH") symbols.add(u)
  }

  for (const re of HIGH_DOGE) {
    if (re.test(title)) {
      bump("high")
      tags.push("elon")
      symbols.add("DOGE")
    }
  }
  for (const re of HIGH_SOL) {
    if (re.test(title)) {
      bump("high")
      if (/outage|halt|down/i.test(title)) tags.push("outage")
      else if (/etf/i.test(title)) tags.push("etf")
      else tags.push("upgrade")
      symbols.add("SOL")
    }
  }
  for (const re of MED_BTC) {
    if (re.test(title)) {
      bump("med")
      tags.push("macro")
      symbols.add("BTC")
    }
  }

  if (symbols.size === 0) {
    // fallback a currencies listából
    for (const c of currencies) {
      const u = c.toUpperCase()
      if (u === "SOL" || u === "DOGE" || u === "BTC") symbols.add(u)
    }
  }

  return { severity, tags: [...new Set(tags)], symbols: [...symbols] }
}

function expiresFor(severity: CatalystSeverity, publishedAt: Date): Date {
  const hours = severity === "high" ? 6 : severity === "med" ? 12 : 24
  return new Date(publishedAt.getTime() + hours * 3600_000)
}

export async function fetchAndStoreCryptoPanic(supabase: SupabaseClient): Promise<number> {
  const token = process.env.CRYPTOPANIC_TOKEN
  const params = new URLSearchParams({
    currencies: "SOL,DOGE,BTC",
    filter: "hot",
    public: "true",
  })
  if (token) params.set("auth_token", token)

  const url = `https://cryptopanic.com/api/v1/posts/?${params.toString()}`
  let res: Response
  try {
    res = await fetch(url, { cache: "no-store" })
  } catch (e) {
    console.error("CryptoPanic network hiba:", e)
    return 0
  }
  if (!res.ok) {
    console.error("CryptoPanic HTTP", res.status)
    return 0
  }

  const json = (await res.json()) as {
    results?: {
      title?: string
      url?: string
      published_at?: string
      currencies?: { code?: string }[]
    }[]
  }

  const results = json.results ?? []
  let inserted = 0

  for (const post of results.slice(0, 25)) {
    if (!post.title || !post.published_at) continue
    const currencies = (post.currencies ?? []).map((c) => c.code ?? "").filter(Boolean)
    const scored = scoreNews(post.title, currencies)
    if (scored.symbols.length === 0) continue

    const publishedAt = new Date(post.published_at)
    // ne mentsünk 48 óránál régebbit
    if (Date.now() - publishedAt.getTime() > 48 * 3600_000) continue

    // dedup: ugyanaz a cím az utolsó 2 napban
    const { data: existing } = await supabase
      .from("crypto_news")
      .select("id")
      .eq("title", post.title)
      .gte("published_at", new Date(Date.now() - 48 * 3600_000).toISOString())
      .limit(1)

    if (existing && existing.length > 0) continue

    const { error } = await supabase.from("crypto_news").insert({
      symbols: scored.symbols,
      title: post.title,
      url: post.url ?? null,
      source: "cryptopanic",
      severity: scored.severity,
      tags: scored.tags,
      published_at: publishedAt.toISOString(),
      expires_at: expiresFor(scored.severity, publishedAt).toISOString(),
    })
    if (!error) inserted++
  }

  return inserted
}

export async function loadActiveCatalysts(
  supabase: SupabaseClient
): Promise<Catalyst[]> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("crypto_news")
    .select("id, symbols, title, url, source, severity, tags, published_at, expires_at")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .gte("published_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("published_at", { ascending: false })
    .limit(30)

  if (error || !data) {
    if (error) console.error("Hír betöltés hiba:", error.message)
    return []
  }

  const now = Date.now()
  return data
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => {
      const published = new Date(row.published_at).getTime()
      return {
        id: row.id as string,
        source: row.source as Catalyst["source"],
        title: row.title as string,
        url: (row.url as string) ?? null,
        severity: row.severity as CatalystSeverity,
        tags: (row.tags as string[]) ?? [],
        symbols: (row.symbols as string[]) ?? [],
        ageMin: Math.max(0, Math.round((now - published) / 60_000)),
        publishedAt: row.published_at as string,
      }
    })
}

export async function createManualCatalyst(
  supabase: SupabaseClient,
  input: {
    title: string
    symbols: string[]
    severity: CatalystSeverity
    tags?: string[]
    url?: string | null
    hoursValid?: number
  }
): Promise<{ id: string } | { error: string }> {
  const publishedAt = new Date()
  const hours = input.hoursValid ?? (input.severity === "high" ? 6 : 12)
  const { data, error } = await supabase
    .from("crypto_news")
    .insert({
      symbols: input.symbols,
      title: input.title,
      url: input.url ?? null,
      source: "manual",
      severity: input.severity,
      tags: input.tags ?? ["manual"],
      published_at: publishedAt.toISOString(),
      expires_at: new Date(publishedAt.getTime() + hours * 3600_000).toISOString(),
    })
    .select("id")
    .single()

  if (error || !data) return { error: error?.message ?? "insert failed" }
  return { id: data.id }
}

/** DOGE high-severity katalizátor az utolsó 2–6 órában? */
export function dogeCatalystActive(catalysts: Catalyst[]): boolean {
  return catalysts.some(
    (c) =>
      c.symbols.includes("DOGE") &&
      c.severity === "high" &&
      c.ageMin <= 6 * 60
  )
}
