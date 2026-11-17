import { sendFormEmail } from "@/lib/mail"
import { getJobBySlug } from "@/lib/jobs"
import {
  ENERGY_LABELS,
  EXPERIENCE_LABELS,
  SCREENING_SCALE_VALUES,
  SITU_MAX_CHARS,
  SITU_MIN_CHARS,
  START_LABELS,
  isScreeningOpen,
  isValidScreeningEmail,
} from "@/lib/career-screening"

export const FORM_TYPES = [
  "contact",
  "partner",
  "quote",
  "career",
  "career_screening",
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
  career_screening: "Karrier – szűrő kérdőív (bolti eladó)",
  felmeres: "Egyedi bútor – helyszíni felmérés",
}

/** Karrier megkeresések ide mennek. A felmérés CC ugyanez. */
const CAREER_TO = "mezo.david@baugeneral.hu"
const FELMERES_CC = "mezo.david@baugeneral.hu"

function recipientsFor(form: FormType): string | undefined {
  if (form === "career" || form === "career_screening") return CAREER_TO
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
  situ: SITU_MAX_CHARS,
  salary: 12,
} as const

const SCALE_SET = new Set<string>(SCREENING_SCALE_VALUES)
const ENERGY_SET = new Set(["up", "down"])

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
  /** 2. körös szűrő (career_screening) */
  salaryNet?: string
  commuteOk?: string
  scaleCustomer?: string
  scaleEnergy?: string
  scalePunctual?: string
  scaleMoney?: string
  scaleAdmin?: string
  scaleCalm?: string
  scalePatience?: string
  situTriple?: string
  situAngry?: string
  situCash?: string
  situLate?: string
  situLikeDislike?: string
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

export type CareerDeepScreening = {
  salaryNet: number
  salaryLabel: string
  commuteOk: string
  commuteLabel: string
  morningOk: string
  morningLabel: string
  fullShiftOk: string
  fullShiftLabel: string
  saturdayOk: string
  saturdayLabel: string
  startWhen: string
  startLabel: string
  experience: string
  experienceLabel: string
  fitLabel: string
  scaleCustomer: string
  scaleEnergy: string
  scaleEnergyLabel: string
  scalePunctual: string
  scaleMoney: string
  scaleAdmin: string
  scaleCalm: string
  scalePatience: string
  situTriple: string
  situAngry: string
  situCash: string
  situLate: string
  situLikeDislike: string
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
  screening?: CareerDeepScreening
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

  // Felmérés és karrier (1. kör): e-mail opcionális. Szűrő: kötelező.
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
        form === "career" || form === "career_screening"
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
  let screening: CareerDeepScreening | undefined

  if (form === "career_screening") {
    if (!isScreeningOpen()) {
      return {
        kind: "error",
        error: "A kérdőív határideje lejárt.",
        status: 400,
      }
    }
    if (!isValidScreeningEmail(email)) {
      return {
        kind: "error",
        error: "Érvényes e-mail címet adj meg (pl. nev@email.hu).",
        status: 400,
      }
    }
    const phoneDigits = phone.replace(/\D/g, "")
    const national =
      phoneDigits.startsWith("36") && phoneDigits.length >= 11
        ? phoneDigits.slice(2)
        : phoneDigits.startsWith("06")
          ? phoneDigits.slice(2)
          : phoneDigits.startsWith("0")
            ? phoneDigits.slice(1)
            : phoneDigits
    if (national.length < 9) {
      return {
        kind: "error",
        error: "Add meg a telefonszámot (pl. +36 30 132 9999).",
        status: 400,
      }
    }

    const salaryRaw = (body.salaryNet || "").replace(/\D/g, "")
    const salaryNet = Number.parseInt(salaryRaw, 10)
    if (
      !salaryRaw ||
      salaryRaw.length > MAX.salary ||
      !Number.isFinite(salaryNet) ||
      salaryNet < 100_000 ||
      salaryNet > 2_000_000
    ) {
      return {
        kind: "error",
        error: "Add meg a nettó havi bérigényed Ft-ban (csak szám, pl. 350 000).",
        status: 400,
      }
    }

    const commuteOk = (body.commuteOk || "").trim()
    const scaleCustomer = (body.scaleCustomer || "").trim()
    const scaleEnergy = (body.scaleEnergy || "").trim()
    const scalePunctual = (body.scalePunctual || "").trim()
    const scaleMoney = (body.scaleMoney || "").trim()
    const scaleAdmin = (body.scaleAdmin || "").trim()
    const scaleCalm = (body.scaleCalm || "").trim()
    const scalePatience = (body.scalePatience || "").trim()
    const situTriple = (body.situTriple || "").trim()
    const situAngry = (body.situAngry || "").trim()
    const situCash = (body.situCash || "").trim()
    const situLate = (body.situLate || "").trim()
    const situLikeDislike = (body.situLikeDislike || "").trim()

    if (!CAREER_YES_NO.has(morningOk)) {
      return {
        kind: "error",
        error: "Jelöld, vállalod-e a H–P 7:30 kezdést.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(fullShiftOk)) {
      return {
        kind: "error",
        error: "Jelöld, vállalod-e a 17:00-ig tartó műszakot.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(saturdayOk)) {
      return {
        kind: "error",
        error: "Jelöld, vállalod-e az időnkénti szombatot.",
        status: 400,
      }
    }
    if (!CAREER_YES_NO.has(commuteOk)) {
      return {
        kind: "error",
        error: "Jelöld, megoldott-e a bejárás.",
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
    if (!CAREER_EXPERIENCE.has(experience)) {
      return {
        kind: "error",
        error: "Válaszd ki a tapasztalatot.",
        status: 400,
      }
    }
    for (const [label, value] of [
      ["ügyfélkontakt", scaleCustomer],
      ["pontosság", scalePunctual],
      ["pénz/bizonylat", scaleMoney],
      ["adminisztráció", scaleAdmin],
      ["nyugalom", scaleCalm],
      ["türelem", scalePatience],
    ] as const) {
      if (!SCALE_SET.has(value)) {
        return {
          kind: "error",
          error: `Érvénytelen skála: ${label}.`,
          status: 400,
        }
      }
    }
    if (!ENERGY_SET.has(scaleEnergy)) {
      return {
        kind: "error",
        error: "Válaszd ki: feltölt vagy kimerít.",
        status: 400,
      }
    }

    const situFields = [
      ["Három vásárló", situTriple],
      ["Hangos vásárló", situAngry],
      ["Kassza eltérés", situCash],
      ["Késés", situLate],
      ["Mit bírsz / nem bírsz", situLikeDislike],
    ] as const
    for (const [label, value] of situFields) {
      if (value.length < SITU_MIN_CHARS || value.length > SITU_MAX_CHARS) {
        return {
          kind: "error",
          error: `A(z) „${label}” válasz legyen ${SITU_MIN_CHARS}–${SITU_MAX_CHARS} karakter.`,
          status: 400,
        }
      }
    }

    const fits =
      morningOk === "yes" && fullShiftOk === "yes" && saturdayOk === "yes"

    screening = {
      salaryNet,
      salaryLabel: `${salaryNet.toLocaleString("hu-HU")} Ft / hó (nettó)`,
      commuteOk,
      commuteLabel: commuteOk === "yes" ? "Igen" : "Nem",
      morningOk,
      morningLabel: morningOk === "yes" ? "Igen" : "Nem",
      fullShiftOk,
      fullShiftLabel: fullShiftOk === "yes" ? "Igen, 17:00-ig" : "Nem",
      saturdayOk,
      saturdayLabel: saturdayOk === "yes" ? "Igen" : "Nem",
      startWhen,
      startLabel: START_LABELS[startWhen] || startWhen,
      experience,
      experienceLabel: EXPERIENCE_LABELS[experience] || experience,
      fitLabel: fits ? "Illik a műszakhoz" : "NEM ILLIK a műszakhoz",
      scaleCustomer,
      scaleEnergy,
      scaleEnergyLabel: ENERGY_LABELS[scaleEnergy] || scaleEnergy,
      scalePunctual,
      scaleMoney,
      scaleAdmin,
      scaleCalm,
      scalePatience,
      situTriple,
      situAngry,
      situCash,
      situLate,
      situLikeDislike,
    }
  }

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
      : form === "career_screening"
        ? "Bolti eladó – szűrő"
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
      screening,
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
  if (data.screening) {
    const s = data.screening
    lines.push(
      "",
      "2. körös szűrő:",
      `Illeszkedés: ${s.fitLabel}`,
      `Nettó bérigény: ${s.salaryLabel}`,
      `Kezdés: ${s.startLabel}`,
      `Reggel 7:30: ${s.morningLabel}`,
      `Műszak 17:00-ig: ${s.fullShiftLabel}`,
      `Szombat 8–12: ${s.saturdayLabel}`,
      `Bejárás: ${s.commuteLabel}`,
      `Tapasztalat: ${s.experienceLabel}`,
      "",
      "Skálák (1–5):",
      `Ügyfélkontakt: ${s.scaleCustomer}`,
      `Beszéd energiája: ${s.scaleEnergyLabel}`,
      `Pontosság: ${s.scalePunctual}`,
      `Pénz/bizonylat: ${s.scaleMoney}`,
      `Adminisztráció: ${s.scaleAdmin}`,
      `Nyugalom: ${s.scaleCalm}`,
      `Türelem: ${s.scalePatience}`,
      "",
      "Helyzetek:",
      `Három vásárló: ${s.situTriple}`,
      `Hangos vásárló: ${s.situAngry}`,
      `Kassza: ${s.situCash}`,
      `Késés: ${s.situLate}`,
      `Bír / nem bír: ${s.situLikeDislike}`,
    )
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
          data.form === "career" || data.form === "career_screening"
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
    data.screening ? ["Illeszkedés", data.screening.fitLabel] : null,
    data.screening ? ["Nettó bérigény", data.screening.salaryLabel] : null,
    data.screening ? ["Kezdés", data.screening.startLabel] : null,
    data.screening ? ["Reggel 7:30", data.screening.morningLabel] : null,
    data.screening
      ? ["Műszak 17:00-ig", data.screening.fullShiftLabel]
      : null,
    data.screening ? ["Szombat 8–12", data.screening.saturdayLabel] : null,
    data.screening ? ["Bejárás", data.screening.commuteLabel] : null,
    data.screening ? ["Tapasztalat", data.screening.experienceLabel] : null,
    data.screening
      ? ["Ügyfélkontakt (1–5)", data.screening.scaleCustomer]
      : null,
    data.screening
      ? ["Beszéd energiája", data.screening.scaleEnergyLabel]
      : null,
    data.screening
      ? ["Pontosság (1–5)", data.screening.scalePunctual]
      : null,
    data.screening
      ? ["Pénz/bizonylat (1–5)", data.screening.scaleMoney]
      : null,
    data.screening
      ? ["Adminisztráció (1–5)", data.screening.scaleAdmin]
      : null,
    data.screening ? ["Nyugalom (1–5)", data.screening.scaleCalm] : null,
    data.screening
      ? ["Türelem (1–5)", data.screening.scalePatience]
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

  const situHtml = data.screening
    ? [
        ["Három vásárló", data.screening.situTriple],
        ["Hangos vásárló", data.screening.situAngry],
        ["Kassza eltérés", data.screening.situCash],
        ["Késés", data.screening.situLate],
        ["Bír / nem bír", data.screening.situLikeDislike],
      ]
        .map(
          ([k, v]) =>
            `<p style="margin-top:14px;font-weight:600">${escapeHtml(k)}</p><p style="white-space:pre-wrap">${escapeHtml(v)}</p>`,
        )
        .join("")
    : ""

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111">
<p>Új beküldés a Hírös-Ablak weboldalról.</p>
<table>${htmlRows}</table>
${situHtml}
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
        : data.form === "career_screening"
          ? [
              data.screening?.fitLabel?.startsWith("NEM")
                ? "Karrier szűrés [NEM ILLIK]"
                : "Karrier szűrés",
              data.screening?.salaryLabel,
              data.name,
            ].filter(Boolean)
          : [FORM_LABELS[data.form], data.name]
  if (
    data.form !== "felmeres" &&
    data.form !== "career" &&
    data.form !== "career_screening" &&
    data.topicLabel
  ) {
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
