/** DNS-over-HTTPS lekérdezés (Cloudflare, tartalék: Google) — nincs helyi resolver cache. */

export type DnsType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'NS' | 'CAA'

const TYPE_CODE: Record<DnsType, number> = { A: 1, NS: 2, CNAME: 5, TXT: 16, AAAA: 28, CAA: 257 }

export type DnsAnswer = { name: string; type: DnsType | 'OTHER'; data: string }

export type DnsResult = {
  /** false: a lekérdezés nem sikerült (hálózat) — ne mondjuk a felhasználónak, hogy rossz a rekord. */
  ok: boolean
  nxdomain: boolean
  answers: DnsAnswer[]
}

const CODE_TYPE = new Map(Object.entries(TYPE_CODE).map(([k, v]) => [v, k as DnsType]))

const ENDPOINTS = [
  (name: string, type: DnsType) =>
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  (name: string, type: DnsType) =>
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`
]

function clean(data: string, type: DnsType | 'OTHER'): string {
  let d = data.trim()
  if (type === 'TXT') d = d.replace(/^"|"$/g, '').replace(/"\s*"/g, '')
  if (type === 'CNAME' || type === 'NS') d = d.replace(/\.$/, '').toLowerCase()
  return d
}

export async function dnsQuery(name: string, type: DnsType): Promise<DnsResult> {
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint(name, type), {
        headers: { accept: 'application/dns-json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000)
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        Status: number
        Answer?: { name: string; type: number; data: string }[]
      }
      const answers = (json.Answer ?? []).map((a): DnsAnswer => {
        const t: DnsAnswer['type'] = CODE_TYPE.get(a.type) ?? 'OTHER'
        return { name: a.name.replace(/\.$/, '').toLowerCase(), type: t, data: clean(a.data, t) }
      })
      return { ok: json.Status === 0 || json.Status === 3, nxdomain: json.Status === 3, answers }
    } catch {
      /* következő szolgáltató */
    }
  }
  return { ok: false, nxdomain: false, answers: [] }
}

/** Csak a kért típusú válaszok (A lekérdezésnél a CNAME lánc kiszűrve). */
export function answersOf(result: DnsResult, type: DnsType): string[] {
  return result.answers.filter((a) => a.type === type).map((a) => a.data)
}
