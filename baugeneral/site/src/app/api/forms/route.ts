import { NextResponse } from "next/server"
import {
  logFormSubmission,
  parseAndValidateForm,
  type RawFormBody,
} from "@/lib/forms-server"
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
      { error: "Túl sok kérés. Kérjük, próbálja újra később, vagy írjon e-mailt." },
      { status: 429 },
    )
  }

  logFormSubmission(parsed.data, {
    referer: req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
  })

  return NextResponse.json({ ok: true })
}
