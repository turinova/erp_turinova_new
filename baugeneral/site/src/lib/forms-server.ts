const PROJECT_TYPES = new Set([
  "ipari",
  "kozepulet",
  "tarshaz",
  "csaladi",
  "felujitas",
  "szakagi",
  "egyeb",
])

const PROJECT_TYPE_LABELS: Record<string, string> = {
  ipari: "Ipari épület",
  kozepulet: "Középület",
  tarshaz: "Társasház",
  csaladi: "Családi ház",
  felujitas: "Felújítás",
  szakagi: "Szakági munka",
  egyeb: "Egyéb",
}

/** Must stay in sync with form trade options (SZAKAGI_TRADES + egyeb) */
const SZAKAGI_TRADES = new Set([
  "villany",
  "gepeszet",
  "szerkezet",
  "burkolas",
  "festes",
  "terko",
  "kerites",
  "hoszigeteles",
  "gipszkarton",
  "napelem",
  "egyeb",
])

const SZAKAGI_TRADE_LABELS: Record<string, string> = {
  villany: "Villanyszerelés",
  gepeszet: "Épületgépészet",
  szerkezet: "Szerkezetépítés",
  burkolas: "Burkolás",
  festes: "Festés, mázolás",
  terko: "Térkövezés",
  kerites: "Kerítésépítés",
  hoszigeteles: "Homlokzati hőszigetelés",
  gipszkarton: "Gipszkarton",
  napelem: "Napelem-telepítés",
  egyeb: "Egyéb",
}

const MAX = {
  name: 120,
  email: 200,
  phone: 40,
  company: 160,
  location: 120,
  projectType: 32,
  trade: 32,
  message: 4000,
} as const

export type RawFormBody = {
  form?: string
  name?: string
  email?: string
  phone?: string
  company?: string
  location?: string
  projectType?: string
  trade?: string
  message?: string
  consent?: boolean
  website?: string
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Digits-only length 8–15 after stripping spaces / + / - / () */
function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 8 && digits.length <= 15
}

export type ParsedContactSubmission = {
  form: "contact"
  name: string
  email: string
  phone: string
  company: string
  location: string
  projectType: string
  projectTypeLabel: string
  message: string
}

export type ParsedSzakagiSubmission = {
  form: "szakagi"
  name: string
  email: string
  phone: string
  location: string
  trade: string
  tradeLabel: string
  message: string
}

export type ParsedFormSubmission = ParsedContactSubmission | ParsedSzakagiSubmission

export type ParseFormResult =
  | { kind: "honeypot" }
  | { kind: "error"; error: string; status: number }
  | { kind: "ok"; data: ParsedFormSubmission }

export function parseAndValidateForm(body: RawFormBody): ParseFormResult {
  if (body.website && body.website.trim() !== "") {
    return { kind: "honeypot" }
  }

  const formType = (body.form || "").trim()
  if (formType === "szakagi") {
    return parseSzakagi(body)
  }
  if (formType === "contact") {
    return parseContact(body)
  }
  return { kind: "error", error: "Érvénytelen űrlaptípus.", status: 400 }
}

function parseContact(body: RawFormBody): ParseFormResult {
  const name = (body.name || "").trim()
  const email = (body.email || "").trim()
  const phone = (body.phone || "").trim()
  const company = (body.company || "").trim()
  const location = (body.location || "").trim()
  const projectType = (body.projectType || "").trim()
  const message = (body.message || "").trim()
  const consent = body.consent === true

  if (!name || name.length > MAX.name) {
    return { kind: "error", error: "Érvénytelen név.", status: 400 }
  }
  if (!email || email.length > MAX.email || !isValidEmail(email)) {
    return { kind: "error", error: "Érvénytelen e-mail cím.", status: 400 }
  }
  if (!phone || phone.length > MAX.phone || !isValidPhone(phone)) {
    return { kind: "error", error: "Érvénytelen telefonszám.", status: 400 }
  }
  if (company.length > MAX.company) {
    return { kind: "error", error: "Érvénytelen cégnév.", status: 400 }
  }
  if (location.length > MAX.location) {
    return { kind: "error", error: "Érvénytelen település.", status: 400 }
  }
  if (!projectType || !PROJECT_TYPES.has(projectType)) {
    return { kind: "error", error: "Érvénytelen projekt típus.", status: 400 }
  }
  if (!message || message.length < 10 || message.length > MAX.message) {
    return { kind: "error", error: "Érvénytelen üzenet.", status: 400 }
  }
  if (!consent) {
    return { kind: "error", error: "Az adatkezelési hozzájárulás kötelező.", status: 400 }
  }

  return {
    kind: "ok",
    data: {
      form: "contact",
      name,
      email,
      phone,
      company,
      location,
      projectType,
      projectTypeLabel: PROJECT_TYPE_LABELS[projectType] ?? projectType,
      message,
    },
  }
}

function parseSzakagi(body: RawFormBody): ParseFormResult {
  const name = (body.name || "").trim()
  const email = (body.email || "").trim()
  const phone = (body.phone || "").trim()
  const location = (body.location || "").trim()
  const trade = (body.trade || "").trim()
  const message = (body.message || "").trim()
  const consent = body.consent === true

  if (!name || name.length > MAX.name) {
    return { kind: "error", error: "Érvénytelen név.", status: 400 }
  }
  if (!phone || phone.length > MAX.phone || !isValidPhone(phone)) {
    return { kind: "error", error: "Érvénytelen telefonszám.", status: 400 }
  }
  if (email) {
    if (email.length > MAX.email || !isValidEmail(email)) {
      return { kind: "error", error: "Érvénytelen e-mail cím.", status: 400 }
    }
  }
  if (!location || location.length > MAX.location) {
    return { kind: "error", error: "Érvénytelen település.", status: 400 }
  }
  if (!trade || !SZAKAGI_TRADES.has(trade)) {
    return { kind: "error", error: "Érvénytelen szakág.", status: 400 }
  }
  if (!message || message.length < 10 || message.length > MAX.message) {
    return { kind: "error", error: "Érvénytelen üzenet.", status: 400 }
  }
  if (!consent) {
    return { kind: "error", error: "Az adatkezelési hozzájárulás kötelező.", status: 400 }
  }

  return {
    kind: "ok",
    data: {
      form: "szakagi",
      name,
      email,
      phone,
      location,
      trade,
      tradeLabel: SZAKAGI_TRADE_LABELS[trade] ?? trade,
      message,
    },
  }
}

export function logFormSubmission(
  data: ParsedFormSubmission,
  meta?: { referer?: string | null; userAgent?: string | null },
) {
  console.info(`[forms] ${data.form} submission`, {
    ...data,
    referer: meta?.referer ?? null,
    userAgent: meta?.userAgent ?? null,
    at: new Date().toISOString(),
  })
}
