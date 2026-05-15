import { NextResponse } from "next/server"

/**
 * Public contact form endpoint.
 *
 * NOTE: For now this only validates and logs the submission server-side.
 * The actual email delivery (e.g. via Resend / SMTP) will be wired in a
 * follow-up. The TODO at the bottom of this file marks the integration point.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_TOPICS = new Set([
  "lapszabaszat",
  "elzaras",
  "beszerzes",
  "penzugy",
  "asztalos",
  "egyeb",
])

const MAX_LENGTHS = {
  name: 120,
  email: 200,
  phone: 40,
  topic: 32,
  message: 4000,
}

type Payload = {
  name?: string
  email?: string
  phone?: string
  topic?: string
  message?: string
  consent?: boolean
  website?: string // honeypot
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 })
  }

  // Honeypot: silently succeed so bots don't learn we're filtering them.
  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true })
  }

  const name = (body.name || "").trim()
  const email = (body.email || "").trim()
  const phone = (body.phone || "").trim()
  const topic = (body.topic || "").trim()
  const message = (body.message || "").trim()
  const consent = body.consent === true

  if (!name || name.length > MAX_LENGTHS.name) {
    return NextResponse.json(
      { error: `A név megadása kötelező és legfeljebb ${MAX_LENGTHS.name} karakter lehet.` },
      { status: 400 },
    )
  }
  if (!email || email.length > MAX_LENGTHS.email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Érvénytelen e-mail cím." }, { status: 400 })
  }
  if (phone.length > MAX_LENGTHS.phone) {
    return NextResponse.json(
      { error: `A telefonszám legfeljebb ${MAX_LENGTHS.phone} karakter lehet.` },
      { status: 400 },
    )
  }
  if (!topic || !ALLOWED_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Érvénytelen téma." }, { status: 400 })
  }
  if (!message || message.length < 10 || message.length > MAX_LENGTHS.message) {
    return NextResponse.json(
      {
        error: `Az üzenet legalább 10 karakter, legfeljebb ${MAX_LENGTHS.message} karakter lehet.`,
      },
      { status: 400 },
    )
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Kérjük, fogadja el az adatkezelési tájékoztatót." },
      { status: 400 },
    )
  }

  // TODO: send the email here (e.g. via Resend) once SMTP / API key is set up.
  // For now we just log on the server so the UX is fully testable.
  console.info("[contact] new submission", {
    at: new Date().toISOString(),
    name,
    email,
    phone: phone || null,
    topic,
    messagePreview:
      message.length > 200 ? `${message.slice(0, 200)}…` : message,
    userAgent: req.headers.get("user-agent") || null,
    referer: req.headers.get("referer") || null,
  })

  return NextResponse.json({ ok: true })
}
