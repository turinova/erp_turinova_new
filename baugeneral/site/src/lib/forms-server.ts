import { sendFormEmail } from "@/lib/mail"

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

const FORM_LABELS: Record<ParsedFormSubmission["form"], string> = {
  contact: "Kapcsolat",
  szakagi: "Szakági megkeresés",
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function logFormSubmission(
  data: ParsedFormSubmission,
  meta?: { referer?: string | null; userAgent?: string | null },
) {
  console.info(`[forms] ${data.form} submission`, {
    form: data.form,
    name: data.name,
    email: "email" in data ? data.email : "",
    location: data.location,
    referer: meta?.referer ?? null,
    at: new Date().toISOString(),
  })
}

export async function deliverFormEmail(
  data: ParsedFormSubmission,
  meta?: { referer?: string | null; userAgent?: string | null },
): Promise<void> {
  const formLabel = FORM_LABELS[data.form]
  const detailLabel =
    data.form === "contact" ? data.projectTypeLabel : data.tradeLabel

  const lines: string[] = [
    `Űrlap: ${formLabel}`,
    `Időpont: ${new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })}`,
    "",
    `Név: ${data.name}`,
  ]
  if (data.email) lines.push(`E-mail: ${data.email}`)
  lines.push(`Telefon: ${data.phone}`)
  if (data.form === "contact" && data.company) {
    lines.push(`Cég: ${data.company}`)
  }
  if (data.location) lines.push(`Helyszín: ${data.location}`)
  lines.push(`${data.form === "contact" ? "Projekt típus" : "Szakág"}: ${detailLabel}`)
  lines.push("", "Üzenet:", data.message)
  if (meta?.referer) lines.push("", `Oldal: ${meta.referer}`)

  const text = lines.join("\n")

  const htmlRows: [string, string][] = [
    ["Űrlap", formLabel],
    ["Név", data.name],
  ]
  if (data.email) htmlRows.push(["E-mail", data.email])
  htmlRows.push(["Telefon", data.phone])
  if (data.form === "contact" && data.company) {
    htmlRows.push(["Cég", data.company])
  }
  if (data.location) htmlRows.push(["Helyszín", data.location])
  htmlRows.push([
    data.form === "contact" ? "Projekt típus" : "Szakág",
    detailLabel,
  ])

  const htmlTable = htmlRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111">
<p>Új beküldés a BauGenerál weboldalról.</p>
<table>${htmlTable}</table>
<p style="margin-top:16px;font-weight:600">Üzenet</p>
<p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
${meta?.referer ? `<p style="margin-top:16px;font-size:12px;color:#666">Forrás: ${escapeHtml(meta.referer)}</p>` : ""}
</body></html>`

  await sendFormEmail({
    subject: `[BauGenerál] ${formLabel} – ${detailLabel} – ${data.name}`,
    text,
    html,
    replyTo: data.email || undefined,
  })
}
