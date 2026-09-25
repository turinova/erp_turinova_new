import type { DnsProviderId } from '@/lib/storefront/domains/providers'

export type DomainStatus = 'pending' | 'verifying' | 'active' | 'error'

export type RecordState = 'ok' | 'missing' | 'wrong' | 'unknown'

export type DomainRecordCheck = {
  key: string
  type: 'A' | 'CNAME' | 'TXT'
  /** Relatív név a zónában: '@', 'www', 'bolt', '_vercel'. */
  name: string
  fqdn: string
  value: string
  state: RecordState
  found: string[]
  /** Mit lát most a rendszer és mit tegyen — köznyelven. */
  problem: string | null
}

export type DomainIssue = { code: string; title: string; fix: string }

export type DomainCheckResult = {
  checkedAt: string
  apex: string
  nameservers: string[]
  detectedProvider: DnsProviderId | null
  registered: boolean | null
  records: DomainRecordCheck[]
  issues: DomainIssue[]
  vercel: { configured: boolean; verified: boolean | null; message: string | null }
  httpsReady: boolean | null
}

export type DomainView = {
  id: string
  hostname: string
  aliasHostname: string | null
  status: DomainStatus
  isPrimary: boolean
  provider: DnsProviderId | null
  result: DomainCheckResult | null
  lastCheckedAt: string | null
  lastError: string | null
}
