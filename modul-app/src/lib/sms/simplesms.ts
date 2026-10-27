import { smsSegments } from '@/lib/sms/text'

const BASE_URI = 'https://api.simplesms.hu'
const DEFAULT_COUNTRY = '36'
/** Token újrahasználat — connect előtt frissítünk, ha hamar lejár. */
const TOKEN_SKEW_MS = 30_000

export type SimpleSmsSendResult =
  | { ok: true; sid: string; segments: number; bodyLength: number }
  | { ok: false; error: string; segments: number; bodyLength: number }

type Creds = {
  username: string
  password: string
  domain: string
}

type TokenCache = {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

/** ITU calling codes — longest-prefix match (PHP SDK parity). */
const COUNTRY_CODES = new Set([
  '1',
  '7',
  '20',
  '27',
  '30',
  '31',
  '32',
  '33',
  '34',
  '36',
  '39',
  '40',
  '41',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '81',
  '82',
  '84',
  '86',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '98',
  '211',
  '212',
  '213',
  '216',
  '218',
  '220',
  '221',
  '222',
  '223',
  '224',
  '225',
  '226',
  '227',
  '228',
  '229',
  '230',
  '231',
  '232',
  '233',
  '234',
  '235',
  '236',
  '237',
  '238',
  '239',
  '240',
  '241',
  '242',
  '243',
  '244',
  '245',
  '246',
  '247',
  '248',
  '249',
  '250',
  '251',
  '252',
  '253',
  '254',
  '255',
  '256',
  '257',
  '258',
  '260',
  '261',
  '262',
  '263',
  '264',
  '265',
  '266',
  '267',
  '268',
  '269',
  '290',
  '291',
  '297',
  '298',
  '299',
  '350',
  '351',
  '352',
  '353',
  '354',
  '355',
  '356',
  '357',
  '358',
  '359',
  '370',
  '371',
  '372',
  '373',
  '374',
  '375',
  '376',
  '377',
  '378',
  '380',
  '381',
  '382',
  '383',
  '385',
  '386',
  '387',
  '389',
  '420',
  '421',
  '423',
  '500',
  '501',
  '502',
  '503',
  '504',
  '505',
  '506',
  '507',
  '508',
  '509',
  '590',
  '591',
  '592',
  '593',
  '594',
  '595',
  '596',
  '597',
  '598',
  '599',
  '670',
  '672',
  '673',
  '674',
  '675',
  '676',
  '677',
  '678',
  '679',
  '680',
  '681',
  '682',
  '683',
  '685',
  '686',
  '687',
  '688',
  '689',
  '690',
  '691',
  '692',
  '850',
  '852',
  '853',
  '855',
  '856',
  '880',
  '886',
  '960',
  '961',
  '962',
  '963',
  '964',
  '965',
  '966',
  '967',
  '968',
  '970',
  '971',
  '972',
  '973',
  '974',
  '975',
  '976',
  '977',
  '992',
  '993',
  '994',
  '995',
  '996',
  '998'
])

function simplesmsCredentials(): Creds | null {
  const username = process.env.SIMPLESMS_USERNAME?.trim()
  const password = process.env.SIMPLESMS_PASSWORD?.trim()
  const domain = process.env.SIMPLESMS_DOMAIN?.trim() ?? ''
  if (!username || !password) return null
  return { username, password, domain }
}

function extractCountryCode(digits: string): [string, string] {
  for (const len of [3, 2, 1] as const) {
    const candidate = digits.slice(0, len)
    if (candidate.length === len && COUNTRY_CODES.has(candidate)) {
      return [candidate, digits.slice(len)]
    }
  }
  return [digits.slice(0, 2), digits.slice(2)]
}

/**
 * SimpleSMS PhoneNumber::split parity — country_code / area_code / number.
 * @see https://github.com/apponhu/simplesms
 */
export function splitSimpleSmsPhone(
  raw: string,
  defaultCountryCode = DEFAULT_COUNTRY
): { country_code: string; area_code: string; number: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/\D+/g, '')
  if (!digits) return null

  const international =
    trimmed.startsWith('+') || digits.startsWith('00')

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  let countryCode: string
  let rest: string

  if (international) {
    ;[countryCode, rest] = extractCountryCode(digits)
  } else if (
    defaultCountryCode &&
    digits.startsWith(defaultCountryCode)
  ) {
    countryCode = defaultCountryCode
    rest = digits.slice(defaultCountryCode.length)
  } else {
    countryCode = defaultCountryCode
    rest = digits.startsWith('06') ? digits.slice(2) : digits.replace(/^0+/, '')
  }

  if (rest.length < 3) return null
  const area_code = rest.slice(0, 2)
  const number = rest.slice(2)
  if (!area_code || !number) return null
  return { country_code: countryCode, area_code, number }
}

function unwrapBody(data: unknown): Record<string, unknown> {
  if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
    return data[0] as Record<string, unknown>
  }
  if (data && typeof data === 'object') {
    return data as Record<string, unknown>
  }
  return {}
}

async function apiRequest(
  method: 'GET' | 'POST',
  path: string,
  body: Record<string, string> | null,
  token: string | null
): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE_URI}${path}`, init)
  const raw = await res.text()
  let parsed: unknown = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }
  return { status: res.status, data: unwrapBody(parsed), raw }
}

async function connect(creds: Creds): Promise<string> {
  const { status, data } = await apiRequest(
    'POST',
    '/rest/SMSapi/connect',
    {
      username: creds.username,
      password: creds.password,
      domain: creds.domain
    },
    null
  )

  const token =
    (typeof data.access_token === 'string' && data.access_token) ||
    (typeof data.token === 'string' && data.token) ||
    null

  if (status < 200 || status >= 300 || !token) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `SimpleSMS connect sikertelen (HTTP ${status}).`
    throw new Error(msg)
  }

  const expiresInSec =
    typeof data.expires_in === 'number'
      ? data.expires_in
      : typeof data.expires_in === 'string'
        ? Number(data.expires_in)
        : 300

  const ttlMs = Number.isFinite(expiresInSec)
    ? Math.max(60, expiresInSec) * 1000
    : 300_000

  tokenCache = {
    token,
    expiresAt: Date.now() + ttlMs - TOKEN_SKEW_MS
  }
  return token
}

async function getToken(creds: Creds, force = false): Promise<string> {
  if (
    !force &&
    tokenCache &&
    tokenCache.expiresAt > Date.now() &&
    tokenCache.token
  ) {
    return tokenCache.token
  }
  return connect(creds)
}

/** Platform SimpleSMS REST — nincs client-side secret. */
export async function sendSimpleSms(input: {
  toE164: string
  body: string
}): Promise<SimpleSmsSendResult> {
  const bodyLength = input.body.length
  const segments = smsSegments(input.body)

  const creds = simplesmsCredentials()
  if (!creds) {
    return {
      ok: false,
      error: 'SimpleSMS nincs konfigurálva (SIMPLESMS_USERNAME / PASSWORD).',
      segments,
      bodyLength
    }
  }

  if (!input.body.trim()) {
    return {
      ok: false,
      error: 'Üres SMS szöveg.',
      segments,
      bodyLength
    }
  }

  const parts = splitSimpleSmsPhone(input.toE164)
  if (!parts) {
    return {
      ok: false,
      error: 'Érvénytelen telefonszám a SimpleSMS küldéshez.',
      segments,
      bodyLength
    }
  }

  try {
    const sendOnce = async (forceConnect: boolean) => {
      const token = await getToken(creds, forceConnect)
      return apiRequest(
        'POST',
        '/rest/SMSapi/sendSMS',
        {
          country_code: parts.country_code,
          area_code: parts.area_code,
          number: parts.number,
          message: input.body
        },
        token
      )
    }

    let { status, data } = await sendOnce(false)
    if (status === 401) {
      tokenCache = null
      ;({ status, data } = await sendOnce(true))
    }

    if (status < 200 || status >= 300) {
      const err =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        (typeof data.response === 'string' && data.response) ||
        `SimpleSMS HTTP ${status}`
      console.error('[SMS] SimpleSMS error', err)
      return { ok: false, error: err, segments, bodyLength }
    }

    const sid =
      (typeof data.response === 'string' && data.response) ||
      (typeof data.response === 'number' && String(data.response)) ||
      (typeof data.sms_id === 'string' && data.sms_id) ||
      (typeof data.id === 'string' && data.id) ||
      ''

    if (!sid) {
      return {
        ok: false,
        error: 'SimpleSMS nem adott vissza sms_id-t.',
        segments,
        bodyLength
      }
    }

    return { ok: true, sid, segments, bodyLength }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'SimpleSMS hálózati hiba'
    console.error('[SMS] SimpleSMS fetch', message)
    return { ok: false, error: message, segments, bodyLength }
  }
}
