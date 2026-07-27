import { NextResponse } from "next/server"
import {
  deliverFormEmail,
  parseAndValidateForm,
  type RawFormBody,
} from "@/lib/forms-server"
import { isMailConfigured } from "@/lib/mail"
import { checkRateLimit, clientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CV_MAX_BYTES = 5 * 1024 * 1024
const CV_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
])

function sanitizeFilename(name: string) {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "cv"
  return base.slice(0, 120)
}

function isAllowedCvName(name: string) {
  const lower = name.toLowerCase()
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  )
}

async function parseBody(req: Request): Promise<{
  body: RawFormBody
  attachment?: { filename: string; content: Buffer; contentType?: string }
  error?: string
}> {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData()
    const consentRaw = fd.get("consent")
    const body: RawFormBody = {
      form: String(fd.get("form") || ""),
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      company: String(fd.get("company") || ""),
      topic: String(fd.get("topic") || ""),
      message: String(fd.get("message") || ""),
      consent: consentRaw === "true" || consentRaw === "on",
      website: String(fd.get("website") || ""),
    }

    const cv = fd.get("cv")
    if (cv instanceof File && cv.size > 0) {
      if (cv.size > CV_MAX_BYTES) {
        return { body, error: "Az önéletrajz max. 5 MB lehet." }
      }
      if (!isAllowedCvName(cv.name)) {
        return { body, error: "Csak PDF vagy Word fájl (DOC, DOCX)." }
      }
      if (cv.type && !CV_MIME.has(cv.type)) {
        // Some browsers send empty or odd MIME — still allow by extension
        if (!isAllowedCvName(cv.name)) {
          return { body, error: "Érvénytelen fájltípus." }
        }
      }
      const buf = Buffer.from(await cv.arrayBuffer())
      return {
        body,
        attachment: {
          filename: sanitizeFilename(cv.name),
          content: buf,
          contentType: cv.type || undefined,
        },
      }
    }

    return { body }
  }

  try {
    const body = (await req.json()) as RawFormBody
    return { body }
  } catch {
    return {
      body: {},
      error: "Érvénytelen kérés.",
    }
  }
}

export async function POST(req: Request) {
  const parsedReq = await parseBody(req)
  if (parsedReq.error && !parsedReq.body.form) {
    return NextResponse.json({ error: parsedReq.error }, { status: 400 })
  }
  if (parsedReq.error) {
    return NextResponse.json({ error: parsedReq.error }, { status: 400 })
  }

  const body = parsedReq.body
  const parsed = parseAndValidateForm(body)
  if (parsed.kind === "honeypot") {
    return NextResponse.json({ ok: true })
  }
  if (parsed.kind === "error") {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const ip = clientIp(req)
  if (!checkRateLimit(`${ip}:${parsed.data.form}`)) {
    return NextResponse.json(
      { error: "Túl sok kérés. Kérjük, próbálja újra később, vagy hívjon minket." },
      { status: 429 },
    )
  }

  if (!isMailConfigured()) {
    console.error("[forms] SMTP not configured")
    return NextResponse.json(
      { error: "Az e-mail küldés jelenleg nem elérhető. Kérjük, hívjon minket telefonon." },
      { status: 503 },
    )
  }

  try {
    await deliverFormEmail(parsed.data, {
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
      attachment: parsedReq.attachment,
    })
  } catch (err) {
    console.error("[forms] send failed", err)
    return NextResponse.json(
      { error: "Hiba történt a küldés közben. Kérjük, próbálja újra, vagy írjon e-mailt." },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
