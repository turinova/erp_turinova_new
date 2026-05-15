import { sendFormEmail } from "@/lib/mail"

export const FORM_TYPES = ["contact", "partner", "quote"] as const
export type FormType = (typeof FORM_TYPES)[number]

const CONTACT_TOPICS = new Set([
  "lapszabaszat",
  "elzaras",
  "beszerzes",
  "penzugy",
  "asztalos",
  "egyeb",
])

const TOPIC_LABELS: Record<string, string> = {
  lapszabaszat: "Lapszabászat",
  elzaras: "Élzárás",
  beszerzes: "Barkácsáruház, anyagvásárlás",
  penzugy: "Számlázás",
  asztalos: "Asztalos / bútorgyártó kapcsolat",
  egyeb: "Egyedi bútor és egyéb megkeresés",
}

const FORM_LABELS: Record<FormType, string> = {
  contact: "Kapcsolatfelvétel",
  partner: "Asztalos partner – visszahívás",
  quote: "Szállítóláda – árajánlat kérés",
}

const MAX = {
  name: 120,
  email: 200,
  phone: 40,
  company: 160,
  topic: 32,
  message: 4000,
} as const

export type RawFormBody = {
  form?: string
  name?: string
  email?: string
  phone?: string
  company?: string
  topic?: string
  message?: string
  consent?: boolean
  website?: string
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export type ParsedSubmission = {
  form: FormType
  name: string
  email: string
  phone: string
  company: string
  topic: string
  topicLabel: string
  message: string
}

export type ParseFormResult =
  | { kind: "honeypot" }
  | { kind: "error"; error: string; status: number }
  | { kind: "ok"; data: ParsedSubmission }

export function parseAndValidateForm(body: RawFormBody): ParseFormResult {
  if (body.website && body.website.trim() !== "") {
    return { kind: "honeypot" }
  }

  const form = (body.form || "").trim() as FormType
  if (!FORM_TYPES.includes(form)) {
    return { kind: "error", error: "Érvénytelen űrlaptípus.", status: 400 }
  }

  const name = (body.name || "").trim()
  const email = (body.email || "").trim()
  const phone = (body.phone || "").trim()
  const company = (body.company || "").trim()
  const topic = (body.topic || "").trim()
  const message = (body.message || "").trim()
  const consent = body.consent === true

  if (!name || name.length > MAX.name) {
    return { kind: "error", error: "Érvénytelen név.", status: 400 }
  }
  if (!email || email.length > MAX.email || !isValidEmail(email)) {
    return { kind: "error", error: "Érvénytelen e-mail cím.", status: 400 }
  }
  if (phone.length > MAX.phone) {
    return { kind: "error", error: "Érvénytelen telefonszám.", status: 400 }
  }
  if (company.length > MAX.company) {
    return { kind: "error", error: "Érvénytelen vállalkozásnév.", status: 400 }
  }
  if (!consent) {
    return {
      kind: "error",
      error: "Kérjük, fogadja el az adatkezelési tájékoztatót.",
      status: 400,
    }
  }

  if (form === "contact") {
    if (!topic || !CONTACT_TOPICS.has(topic)) {
      return { kind: "error", error: "Érvénytelen téma.", status: 400 }
    }
    if (!message || message.length < 10 || message.length > MAX.message) {
      return {
        kind: "error",
        error: "Az üzenet legalább 10 karakter legyen.",
        status: 400,
      }
    }
  }

  if (form === "partner") {
    if (!phone) {
      return { kind: "error", error: "A telefonszám megadása kötelező.", status: 400 }
    }
    if (message.length > MAX.message) {
      return { kind: "error", error: "Az üzenet túl hosszú.", status: 400 }
    }
  }

  if (form === "quote") {
    if (!message || message.length < 10 || message.length > MAX.message) {
      return {
        kind: "error",
        error: "Az üzenet legalább 10 karakter legyen.",
        status: 400,
      }
    }
  }

  return {
    kind: "ok",
    data: {
      form,
      name,
      email,
      phone,
      company,
      topic,
      topicLabel: topic ? TOPIC_LABELS[topic] || topic : "",
      message,
    },
  }
}

export async function deliverFormEmail(
  data: ParsedSubmission,
  meta: { referer: string | null; userAgent: string | null },
): Promise<void> {
  const lines: string[] = [
    `Űrlap: ${FORM_LABELS[data.form]}`,
    `Időpont: ${new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })}`,
    "",
    `Név: ${data.name}`,
    `E-mail: ${data.email}`,
  ]
  if (data.phone) lines.push(`Telefon: ${data.phone}`)
  if (data.company) lines.push(`Vállalkozás: ${data.company}`)
  if (data.topicLabel) lines.push(`Téma: ${data.topicLabel}`)
  if (data.message) {
    lines.push("", "Üzenet:", data.message)
  }
  if (meta.referer) lines.push("", `Oldal: ${meta.referer}`)

  const text = lines.join("\n")
  const htmlRows = [
    ["Űrlap", FORM_LABELS[data.form]],
    ["Név", data.name],
    ["E-mail", data.email],
    data.phone ? ["Telefon", data.phone] : null,
    data.company ? ["Vállalkozás", data.company] : null,
    data.topicLabel ? ["Téma", data.topicLabel] : null,
  ]
    .filter(Boolean)
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top">${escapeHtml(row![0])}</td><td style="padding:6px 0">${escapeHtml(row![1])}</td></tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111">
<p>Új beküldés a Hírös-Ablak weboldalról.</p>
<table>${htmlRows}</table>
${data.message ? `<p style="margin-top:16px;font-weight:600">Üzenet</p><p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>` : ""}
${meta.referer ? `<p style="margin-top:16px;font-size:12px;color:#666">Forrás: ${escapeHtml(meta.referer)}</p>` : ""}
</body></html>`

  const subjectParts = [FORM_LABELS[data.form], data.name]
  if (data.topicLabel) subjectParts.splice(1, 0, data.topicLabel)

  await sendFormEmail({
    subject: `[Hírös-Ablak] ${subjectParts.join(" – ")}`,
    text,
    html,
    replyTo: data.email,
  })
}
