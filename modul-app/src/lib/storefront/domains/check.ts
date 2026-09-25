/**
 * Saját domain ellenőrzés: elvárt DNS-rekordok, élő DNS (DoH), tipikus hibák,
 * Vercel verifikáció és HTTPS készenlét → a tenant_domains sor új állapota.
 */

import { answersOf, dnsQuery } from '@/lib/storefront/domains/dns'
import { relativeName, splitDomain } from '@/lib/storefront/domains/normalize'
import { detectProvider, type DnsProviderId } from '@/lib/storefront/domains/providers'
import type {
  DomainCheckResult,
  DomainIssue,
  DomainRecordCheck,
  DomainStatus
} from '@/lib/storefront/domains/types'
import { vercelDomainState } from '@/lib/storefront/domains/vercel'

const VERCEL_IP_PREFIXES = ['76.76.21.', '216.198.79.', '216.150.', '64.29.17.']

function isVercelIp(ip: string, expected: string): boolean {
  return ip === expected || VERCEL_IP_PREFIXES.some((p) => ip.startsWith(p))
}

function isVercelCname(target: string, expected: string): boolean {
  return target === expected || /(^|\.)vercel-dns(-\d+)?\.com$/.test(target)
}

function isCloudflareIp(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  if (a === undefined || b === undefined) return false
  return (
    (a === 104 && b >= 16 && b <= 31) ||
    (a === 172 && b >= 64 && b <= 71) ||
    (a === 188 && b === 114) ||
    (a === 162 && b === 158) ||
    (a === 141 && b === 101) ||
    (a === 108 && b === 162)
  )
}

const WAIT_HINT = 'Ha most vetted fel, várj 5–10 percet, mi addig figyeljük.'

async function checkA(fqdn: string, apex: string, expected: string, provider: DnsProviderId | null): Promise<DomainRecordCheck> {
  const base = { key: `A:${fqdn}`, type: 'A' as const, name: relativeName(fqdn, apex), fqdn, value: expected }
  const q = await dnsQuery(fqdn, 'A')
  if (!q.ok) return { ...base, state: 'unknown', found: [], problem: 'Most nem tudtuk lekérdezni. Pár perc múlva újra megnézzük.' }
  const found = answersOf(q, 'A')
  if (found.length === 0) {
    return { ...base, state: 'missing', found, problem: `Még nem látjuk ezt a rekordot. ${WAIT_HINT}` }
  }
  const good = found.filter((ip) => isVercelIp(ip, expected))
  const others = found.filter((ip) => !isVercelIp(ip, expected))
  if (others.length === 0) return { ...base, state: 'ok', found, problem: null }
  if (good.length > 0) {
    return {
      ...base,
      state: 'wrong',
      found,
      problem: `Van mellette egy régi A rekord is (${others.join(', ')}). Töröld, különben a látogatók egy része a régi oldalra jut.`
    }
  }
  if (provider === 'cloudflare' && others.every(isCloudflareIp)) {
    return {
      ...base,
      state: 'wrong',
      found,
      problem: 'A Cloudflare proxy be van kapcsolva (narancs felhő). Kattints rá, hogy szürke legyen („DNS only”).'
    }
  }
  return {
    ...base,
    state: 'wrong',
    found,
    problem: `Most ide mutat: ${others.join(', ')}. Írd át az értéket erre: ${expected} — vagy töröld a régit és vedd fel újra.`
  }
}

async function checkCname(fqdn: string, apex: string, expected: string, expectedA: string): Promise<DomainRecordCheck> {
  const base = { key: `CNAME:${fqdn}`, type: 'CNAME' as const, name: relativeName(fqdn, apex), fqdn, value: expected }
  const q = await dnsQuery(fqdn, 'CNAME')
  if (!q.ok) return { ...base, state: 'unknown', found: [], problem: 'Most nem tudtuk lekérdezni. Pár perc múlva újra megnézzük.' }
  const cnames = answersOf(q, 'CNAME')
  if (cnames.some((c) => isVercelCname(c, expected))) return { ...base, state: 'ok', found: cnames, problem: null }
  if (cnames.length > 0) {
    return {
      ...base,
      state: 'wrong',
      found: cnames,
      problem: `Most ide mutat: ${cnames.join(', ')}. Írd át az értéket erre: ${expected}`
    }
  }
  const a = answersOf(await dnsQuery(fqdn, 'A'), 'A')
  if (a.length > 0 && a.every((ip) => isVercelIp(ip, expectedA))) {
    return { ...base, state: 'ok', found: a, problem: null }
  }
  if (a.length > 0) {
    return {
      ...base,
      state: 'wrong',
      found: a,
      problem: `A(z) „${base.name}” névnél most egy A rekord van (${a.join(', ')}). Töröld, és vegyél fel helyette CNAME rekordot.`
    }
  }
  return { ...base, state: 'missing', found: [], problem: `Még nem látjuk ezt a rekordot. ${WAIT_HINT}` }
}

async function checkTxt(fqdn: string, apex: string, expected: string): Promise<DomainRecordCheck> {
  const base = { key: `TXT:${fqdn}`, type: 'TXT' as const, name: relativeName(fqdn, apex), fqdn, value: expected }
  const q = await dnsQuery(fqdn, 'TXT')
  if (!q.ok) return { ...base, state: 'unknown', found: [], problem: 'Most nem tudtuk lekérdezni. Pár perc múlva újra megnézzük.' }
  const found = answersOf(q, 'TXT')
  if (found.includes(expected)) return { ...base, state: 'ok', found, problem: null }
  return {
    ...base,
    state: found.length > 0 ? 'wrong' : 'missing',
    found,
    problem:
      found.length > 0
        ? 'Van itt TXT rekord, de nem ezzel az értékkel. Vegyél fel egy újat pontosan ezzel az értékkel (a régit nem kell törölni).'
        : `Még nem látjuk ezt a rekordot. ${WAIT_HINT}`
  }
}

async function findIssues(
  hostname: string,
  apex: string,
  records: DomainRecordCheck[]
): Promise<DomainIssue[]> {
  const issues: DomainIssue[] = []

  const aaaa = answersOf(await dnsQuery(hostname, 'AAAA'), 'AAAA')
  if (aaaa.length > 0) {
    issues.push({
      code: 'aaaa',
      title: `Van egy AAAA (IPv6) rekord is a(z) „${relativeName(hostname, apex)}” névnél`,
      fix: 'Töröld az AAAA rekordot, különben egyes látogatók a régi oldalra jutnak.'
    })
  }

  const doubled = await Promise.all(
    records
      .filter((r) => r.state !== 'ok' && r.type !== 'TXT')
      .map(async (r) => {
        const wrongName = `${r.fqdn}.${apex}`
        const q = await dnsQuery(wrongName, r.type)
        return answersOf(q, r.type).length > 0 ? r : null
      })
  )
  for (const r of doubled) {
    if (!r) continue
    issues.push({
      code: `doubled:${r.key}`,
      title: 'A Név mezőbe a teljes domain is bekerült',
      fix:
        r.name === '@'
          ? 'A Név mezőbe csak @ jelet írj (vagy hagyd üresen). Töröld a hibás rekordot, és vedd fel újra.'
          : `A Név mezőbe csak ennyit írj: ${r.name} (a domain nélkül). Töröld a hibás rekordot, és vedd fel újra.`
    })
  }

  const caa = answersOf(await dnsQuery(apex, 'CAA'), 'CAA')
  const issuers = caa.filter((c) => /\bissue(wild)?\b/i.test(c))
  if (issuers.length > 0 && !issuers.some((c) => c.toLowerCase().includes('letsencrypt.org'))) {
    issues.push({
      code: 'caa',
      title: 'Egy CAA rekord megakadályozza a biztonsági tanúsítványt',
      fix: 'Vegyél fel egy új CAA rekordot: Név: @ · Érték: 0 issue "letsencrypt.org"'
    })
  }
  return issues
}

async function httpsReady(hostname: string): Promise<boolean> {
  try {
    await fetch(`https://${hostname}/robots.txt`, {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    })
    return true
  } catch {
    return false
  }
}

export type DomainCheckOutcome = {
  status: DomainStatus
  result: DomainCheckResult
  lastError: string | null
  detectedProvider: DnsProviderId | null
}

export async function runDomainCheck(input: {
  hostname: string
  aliasHostname: string | null
  provider: DnsProviderId | null
}): Promise<DomainCheckOutcome> {
  const { hostname, aliasHostname } = input
  const { apex } = splitDomain(hostname)

  const nsQ = await dnsQuery(apex, 'NS')
  const nameservers = answersOf(nsQ, 'NS')
  const registered = nsQ.ok ? !nsQ.nxdomain && nameservers.length > 0 : null
  const detected = detectProvider(nameservers)
  const provider = input.provider ?? detected

  const preState = await vercelDomainState(hostname, { verify: false })
  const expectedA = preState.recommendedA
  const expectedCname = preState.recommendedCname

  let records: DomainRecordCheck[] = []
  if (detected !== 'vercel') {
    const tasks: Promise<DomainRecordCheck>[] = []
    if (hostname === apex) {
      tasks.push(checkA(hostname, apex, expectedA, provider))
      if (aliasHostname) tasks.push(checkCname(aliasHostname, apex, expectedCname, expectedA))
    } else {
      tasks.push(checkCname(hostname, apex, expectedCname, expectedA))
    }
    for (const v of preState.verification) {
      if (v.type.toUpperCase() === 'TXT') tasks.push(checkTxt(v.domain.replace(/\.$/, ''), apex, v.value))
    }
    records = await Promise.all(tasks)
  }

  const issues = registered === false ? [] : await findIssues(hostname, apex, records)
  const dnsOk = records.every((r) => r.state === 'ok') && registered !== false

  let vercel = { configured: preState.configured, verified: preState.verified, message: null as string | null }
  let ready: boolean | null = null
  if (dnsOk && preState.configured) {
    const post = await vercelDomainState(hostname, { verify: true })
    vercel = { configured: true, verified: post.verified, message: post.error?.message ?? null }
    if (post.verified) ready = await httpsReady(hostname)
  } else if (!preState.configured) {
    vercel.message = 'Ezen a szerveren nincs beállítva a Vercel-kapcsolat (VERCEL_API_TOKEN, VERCEL_PROJECT_ID), ezért a domain nem élesíthető.'
  }

  let status: DomainStatus
  let lastError: string | null = null
  if (registered === false) {
    status = 'error'
    lastError = 'Ezt a domaint nem találjuk. Nézd meg, nincs-e elírás benne, és hogy tényleg megvetted-e.'
  } else if (!dnsOk || issues.some((i) => i.code === 'caa')) {
    status = 'pending'
  } else if (vercel.configured && vercel.verified && ready) {
    status = 'active'
  } else {
    status = 'verifying'
    lastError = vercel.message
  }

  return {
    status,
    lastError,
    detectedProvider: detected,
    result: {
      checkedAt: new Date().toISOString(),
      apex,
      nameservers,
      detectedProvider: detected,
      registered,
      records,
      issues,
      vercel,
      httpsReady: ready
    }
  }
}
