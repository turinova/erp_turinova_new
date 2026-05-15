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

export async function POST(req: Request) {
  let body: RawFormBody
  try {
    body = (await req.json()) as RawFormBody
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 })
  }

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
