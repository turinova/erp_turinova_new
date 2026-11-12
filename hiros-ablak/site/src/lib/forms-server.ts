import { sendFormEmail } from "@/lib/mail"
import { getJobBySlug } from "@/lib/jobs"

export const FORM_TYPES = [
  "contact",
  "partner",
  "quote",
  "career",
  "felmeres",
] as const
export type FormType = (typeof FORM_TYPES)[number]

const CONTACT_TOPICS = new Set([
  "lapszabaszat",
  "elzaras",
  "beszerzes",
  "penzugy",
  "asztalos",
  "egyeb",
])

const FELMERES_TYPES = new Set(["konyha", "gardrob", "furdo", "egyeb"])

const TOPIC_LABELS: Record<string, string> = {
  lapszabaszat: "Lapszabászat",
  elzaras: "Élzárás",
  beszerzes: "Barkácsáruház, anyagvásárlás",
  penzugy: "Számlázás",
  asztalos: "Asztalos / bútorgyártó kapcsolat",
  egyeb: "Egyedi bútor és egyéb megkeresés",
  general: "Általános érdeklődés / nincs nyitott állás",
}

const FELMERES_LABELS: Record<string, string> = {
  konyha: "Konyha",
  gardrob: "Gardrób vagy beépített szekrény",
  furdo: "Fürdőszoba bútor",
  egyeb: "Más egyedi bútor",
}

const FORM_LABELS: Record<FormType, string> = {
  contact: "Kapcsolatfelvétel",
  partner: "Asztalos partner – visszahívás",
  quote: "Szállítóláda – árajánlat kérés",
  career: "Karrier – állásjelentkezés",
  felmeres: "Egyedi bútor – helyszíni felmérés",
}

/** Karrier megkeresések ide mennek. A felmérés CC ugyanez. */
const CAREER_TO = "mezo.david@baugeneral.hu"
const FELMERES_CC = "mezo.david@baugeneral.hu"

function recipientsFor(form: FormType): string | undefined {
  if (form === "career") return CAREER_TO
  if (form !== "felmeres") return undefined

  const set = new Set(
    (process.env.MAIL_TO || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  set.add(FELMERES_CC)
  return [...set].join(", ")
}

const MAX = {
  name: 120,
  email: 200,
  phone: 40,
  company: 160,
  topic: 64,
  message: 4000,
  lastJob: 160,
} as const

const CAREER_YES_NO = new Set(["yes", "no"])
const CAREER_EXPERIENCE = new Set(["bolt", "ugyfel", "none"])
const CAREER_START = new Set(["immediate", "2weeks", "1month", "later"])

const CAREER_EXPERIENCE_LABELS: Record<string, string> = {
  bolt: "Igen, bolti vagy áruházi munka",
  ugyfel: "Igen, más ügyfélkezelés",
  none: "Még nincs, betanulnék",
}

const CAREER_START_LABELS: Record<string, string> = {
  immediate: "Azonnal",
  "2weeks": "2 héten belül",
  "1month": "1 hónapon belül",
  later: "Később",
}

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
  /** Karrier szűrés — Meta-biztos, munkáról */
  scheduleOk?: string
  morningOk?: string
  fullShiftOk?: string
  saturdayOk?: string
  experience?: string
  startWhen?: string
  lastJob?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  cvOptional?: string
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

export type CareerScreening = {
  scheduleOk: string
  scheduleLabel: string
  morningOk: string
  morningLabel: string
  fullShiftOk: string
  fullShiftLabel: string
  saturdayOk: string
  saturdayLabel: string
  experience: string
  experienceLabel: string
  startWhen: string
  startLabel: string
  lastJob: string
  fitLabel: string
}

export type FormUtm = {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
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
  career?: CareerScreening
  utm?: FormUtm
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
  const morningOk = (body.morningOk || "").trim()
  const fullShiftOk = (body.fullShiftOk || "").trim()
  const saturdayOk = (body.saturdayOk || "").trim()
  const scheduleOk =
    (body.scheduleOk || "").trim() ||
    (morningOk === "yes" && fullShiftOk === "yes" && saturdayOk === "yes"
      ? "yes"
      : morningOk || fullShiftOk || saturdayOk
        ? "no"
        : "")
  const experience = (body.experience || "").trim()
  const startWhen = (body.startWhen || "").trim()
  const lastJob = (body.lastJob || "").trim()

  if (!name || name.length > MAX.name) {
    return { kind: "error", error: "Érvénytelen név.", status: 400 }
  }

  // Felmérés és karrier: e-mail opcionális (telefon az elsődleges).
  if (form === "felmeres" || form === "career") {
    if (email && (email.length > MAX.email || !isValidEmail(email))) {
      return { kind: "error", error: "Érvénytelen e-mail cím.", status: 400 }
    }
  } else if (!email || email.length > MAX.email || !isValidEmail(email)) {
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
      error:
        form === "career"
          ? "Fogadd el az adatkezelési tájékoztatót."
          : "Kérjük, fogadja el az adatkezelési tájékoztatót.",
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

  let career: CareerScreening | undefined

  if (form === "career") {
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      return {
        kind: "error",
        error: "A telefonszám megadása kötelező (legalább 9 számjegy).",
        status: 400,
      }
    }
    if (!topic) {
      return { kind: "error", error: "Válassz pozíciót.", status: 400 }
    }
    const job = getJobBySlug(topic)
    if (!job && topic !== "general") {
      return { kind: "error", error: "Érvénytelen pozíció.", status: 400 }
    }
    if (!CAREER_YES_NO.has(morningOk)) {
      return {
        kind: "error",
        error: "Jelöld, be tudsz-e érni hétköznap 7:30-ra.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(fullShiftOk)) {
      return {
        kind: "error",
        error: "Jelöld, végig ott tudsz-e lenni 17:00-ig.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(saturdayOk)) {
      return {
        kind: "error",
        error: "Jelöld, tudsz-e időnként szombaton 8–12 között dolgozni.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(scheduleOk)) {
      return {
        kind: "error",
        error: "Jelöld, neked jó-e a kötött munkaidő.",
        status: 400,
      }
    }
    if (!CAREER_EXPERIENCE.has(experience)) {
      return {
        kind: "error",
        error: "Válaszd ki a tapasztalatot.",
        status: 400,
      }
    }
    if (!CAREER_START.has(startWhen)) {
      return {
        kind: "error",
        error: "Válaszd ki, mikor tudnál kezdeni.",
        status: 400,
      }
    }
    if (lastJob.length > MAX.lastJob) {
      return { kind: "error", error: "Az előző munkahely mező túl hosszú.", status: 400 }
    }
    if (message.length > MAX.message) {
      return { kind: "error", error: "Az üzenet túl hosszú.", status: 400 }
    }

    const fits =
      morningOk === "yes" && fullShiftOk === "yes" && saturdayOk === "yes"

    career = {
      scheduleOk,
      scheduleLabel: scheduleOk === "yes" ? "Igen" : "Nem",
      morningOk,
      morningLabel: morningOk === "yes" ? "Igen" : "Nem",
      fullShiftOk,
      fullShiftLabel:
        fullShiftOk === "yes"
          ? "Igen, 17:00-ig"
          : "Sajnos korábban kellene mennie",
      saturdayOk,
      saturdayLabel: saturdayOk === "yes" ? "Igen" : "Nem",
      experience,
      experienceLabel: CAREER_EXPERIENCE_LABELS[experience] || experience,
      startWhen,
      startLabel: CAREER_START_LABELS[startWhen] || startWhen,
      lastJob,
      fitLabel: fits ? "Illik a műszakhoz" : "NEM ILLIK a műszakhoz",
    }
  }

  if (form === "felmeres") {
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      return {
        kind: "error",
        error: "Adja meg a telefonszámát, hogy visszahívhassuk.",
        status: 400,
      }
    }
    if (!topic || !FELMERES_TYPES.has(topic)) {
      return {
        kind: "error",
        error: "Válassza ki, mit tervez.",
        status: 400,
      }
    }
    // A cím a kvalifikáció alapja, ezért utca és házszám nélkül nem fogadjuk el.
    if (company.length < 8 || !/\d/.test(company)) {
      return {
        kind: "error",
        error: "Adja meg a felmérés helyszínét, utcával és házszámmal.",
        status: 400,
      }
    }
    if (message.length > MAX.message) {
      return { kind: "error", error: "Az üzenet túl hosszú.", status: 400 }
    }
  }

  const topicLabel =
    form === "career"
      ? getJobBySlug(topic)?.title || TOPIC_LABELS[topic] || topic
      : form === "felmeres"
        ? FELMERES_LABELS[topic] || topic
        : topic
          ? TOPIC_LABELS[topic] || topic
          : ""

  const clip = (v: string | undefined) => {
    const t = (v || "").trim()
    return t ? t.slice(0, 120) : undefined
  }
  const utm: FormUtm = {
    source: clip(body.utm_source),
    medium: clip(body.utm_medium),
    campaign: clip(body.utm_campaign),
    content: clip(body.utm_content),
    term: clip(body.utm_term),
  }
  const hasUtm = Boolean(
    utm.source || utm.medium || utm.campaign || utm.content || utm.term,
  )

  return {
    kind: "ok",
    data: {
      form,
      name,
      email,
      phone,
      company,
      topic,
      topicLabel,
      message,
      career,
      utm: hasUtm ? utm : undefined,
    },
  }
}

export async function deliverFormEmail(
  data: ParsedSubmission,
  meta: {
    referer: string | null
    userAgent: string | null
    attachment?: {
      filename: string
      content: Buffer
      contentType?: string
    }
  },
): Promise<void> {
  const lines: string[] = [
    `Űrlap: ${FORM_LABELS[data.form]}`,
    `Időpont: ${new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })}`,
    "",
    `Név: ${data.name}`,
  ]
  if (data.email) lines.push(`E-mail: ${data.email}`)
  if (data.phone) lines.push(`Telefon: ${data.phone}`)
  if (data.company) {
    lines.push(
      data.form === "felmeres"
        ? `Felmérés helyszíne: ${data.company}`
        : `Vállalkozás: ${data.company}`,
    )
  }
  if (data.topicLabel) {
    const topicKey =
      data.form === "career"
        ? "Pozíció"
        : data.form === "felmeres"
          ? "Bútortípus"
          : "Téma"
    lines.push(`${topicKey}: ${data.topicLabel}`)
  }
  if (data.career) {
    lines.push(
      "",
      "Szűrés:",
      `Illeszkedés: ${data.career.fitLabel}`,
      `Reggel 7:30: ${data.career.morningLabel}`,
      `Műszak 17:00-ig: ${data.career.fullShiftLabel}`,
      `Szombat 8–12 (időnként): ${data.career.saturdayLabel}`,
      `Tapasztalat: ${data.career.experienceLabel}`,
      `Kezdés: ${data.career.startLabel}`,
    )
    if (data.career.lastJob) {
      lines.push(`Előző munkahely: ${data.career.lastJob}`)
    }
  }
  if (meta.attachment) lines.push(`Önéletrajz: ${meta.attachment.filename}`)
  if (data.utm) {
    lines.push("", "Kampány (UTM):")
    if (data.utm.source) lines.push(`utm_source: ${data.utm.source}`)
    if (data.utm.medium) lines.push(`utm_medium: ${data.utm.medium}`)
    if (data.utm.campaign) lines.push(`utm_campaign: ${data.utm.campaign}`)
    if (data.utm.content) lines.push(`utm_content: ${data.utm.content}`)
    if (data.utm.term) lines.push(`utm_term: ${data.utm.term}`)
  }
  if (data.message) {
    lines.push("", "Üzenet:", data.message)
  }
  if (meta.referer) lines.push("", `Oldal: ${meta.referer}`)

  const text = lines.join("\n")
  const htmlRows = [
    ["Űrlap", FORM_LABELS[data.form]],
    ["Név", data.name],
    data.email ? ["E-mail", data.email] : null,
    data.phone ? ["Telefon", data.phone] : null,
    data.company
      ? [
          data.form === "felmeres" ? "Felmérés helyszíne" : "Vállalkozás",
          data.company,
        ]
      : null,
    data.topicLabel
      ? [
          data.form === "career"
            ? "Pozíció"
            : data.form === "felmeres"
              ? "Bútortípus"
              : "Téma",
          data.topicLabel,
        ]
      : null,
    data.career ? ["Illeszkedés", data.career.fitLabel] : null,
    data.career ? ["Reggel 7:30", data.career.morningLabel] : null,
    data.career
      ? ["Műszak 17:00-ig", data.career.fullShiftLabel]
      : null,
    data.career
      ? ["Szombat 8–12 (időnként)", data.career.saturdayLabel]
      : null,
    data.career ? ["Tapasztalat", data.career.experienceLabel] : null,
    data.career ? ["Kezdés", data.career.startLabel] : null,
    data.career?.lastJob
      ? ["Előző munkahely", data.career.lastJob]
      : null,
    meta.attachment ? ["Önéletrajz", meta.attachment.filename] : null,
    data.utm?.source ? ["utm_source", data.utm.source] : null,
    data.utm?.medium ? ["utm_medium", data.utm.medium] : null,
    data.utm?.campaign ? ["utm_campaign", data.utm.campaign] : null,
    data.utm?.content ? ["utm_content", data.utm.content] : null,
    data.utm?.term ? ["utm_term", data.utm.term] : null,
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

  // A cím túl hosszú a tárgyhoz, ezért csak a levél törzsében szerepel.
  const subjectParts =
    data.form === "felmeres"
      ? ["Felmérés", data.topicLabel, data.name].filter(Boolean)
      : data.form === "career"
        ? [
            data.career?.fitLabel?.startsWith("NEM")
              ? "Karrier [NEM ILLIK]"
              : "Karrier",
            data.topicLabel,
            data.name,
          ].filter(Boolean)
        : [FORM_LABELS[data.form], data.name]
  if (data.form !== "felmeres" && data.form !== "career" && data.topicLabel) {
    subjectParts.splice(1, 0, data.topicLabel)
  }

  await sendFormEmail({
    subject: `[Hírös-Ablak] ${subjectParts.join(" – ")}`,
    text,
    html,
    replyTo: data.email || undefined,
    to: recipientsFor(data.form),
    attachments: meta.attachment
      ? [
          {
            filename: meta.attachment.filename,
            content: meta.attachment.content,
            contentType: meta.attachment.contentType,
          },
        ]
      : undefined,
  })
}
