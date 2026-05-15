"use client"

import { useState } from "react"

type Topic =
  | "lapszabaszat"
  | "elzaras"
  | "beszerzes"
  | "penzugy"
  | "asztalos"
  | "egyeb"

const TOPIC_OPTIONS: { value: Topic; label: string }[] = [
  { value: "lapszabaszat", label: "Lapszabászat" },
  { value: "elzaras", label: "Élzárás" },
  { value: "beszerzes", label: "Barkácsáruház, anyagvásárlás" },
  { value: "penzugy", label: "Számlázás" },
  { value: "asztalos", label: "Asztalos / bútorgyártó kapcsolat" },
  { value: "egyeb", label: "Egyedi bútor és egyéb megkeresés" },
]

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  name: string
  email: string
  topic: string
  message: string
  consent: string
}>

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      topic: String(data.get("topic") || "").trim(),
      message: String(data.get("message") || "").trim(),
      consent: data.get("consent") === "on",
      // honeypot
      website: String(data.get("website") || "").trim(),
    }

    const nextErrors: FieldErrors = {}
    if (!payload.name) nextErrors.name = "Kérjük, adja meg a nevét."
    if (!payload.email) nextErrors.email = "Kérjük, adja meg az e-mail címét."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
      nextErrors.email = "Kérjük, ellenőrizze az e-mail cím formátumát."
    if (!payload.topic) nextErrors.topic = "Kérjük, válasszon témát."
    if (!payload.message || payload.message.length < 10)
      nextErrors.message = "Az üzenet legalább 10 karakter legyen."
    if (!payload.consent)
      nextErrors.consent = "Kérjük, fogadja el az adatkezelési tájékoztatót."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      setStatus({ kind: "submitting" })
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Hiba történt a küldés közben.")
      }
      setStatus({ kind: "success" })
      form.reset()
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Hiba történt a küldés közben.",
      })
    }
  }

  if (status.kind === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <div className="text-lg font-semibold text-emerald-900">
          Köszönjük, megkaptuk!
        </div>
        <p className="mt-1 text-sm text-emerald-900/80">
          Munkanapokon általában néhány órán belül visszajelzünk. Sürgős
          esetben hívjon:&nbsp;
          <a className="underline underline-offset-4" href="tel:+3676481729">
            +36 76 481 729
          </a>
          .
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Új üzenet
        </button>
      </div>
    )
  }

  const inputBase =
    "block w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-black/90 placeholder:text-black/40 focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
  const labelBase = "block text-sm font-medium text-black/80"
  const errBase = "mt-1 text-sm text-rose-700"

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {/* Honeypot - must remain visually hidden */}
      <div aria-hidden="true" className="hidden">
        <label>
          Ne töltse ki:
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelBase}>
            Név <span className="text-rose-600">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-err" : undefined}
            placeholder="Pl. Kovács János"
          />
          {errors.name && (
            <p id="name-err" className={errBase}>
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="email" className={labelBase}>
            E-mail <span className="text-rose-600">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputBase}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-err" : undefined}
            placeholder="email@pelda.hu"
          />
          {errors.email && (
            <p id="email-err" className={errBase}>
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelBase}>
            Telefon <span className="text-black/45">(nem kötelező)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputBase}
            placeholder="+36 30 123 4567"
          />
        </div>
        <div>
          <label htmlFor="topic" className={labelBase}>
            Téma <span className="text-rose-600">*</span>
          </label>
          <select
            id="topic"
            name="topic"
            required
            className={inputBase}
            defaultValue=""
            aria-invalid={!!errors.topic}
            aria-describedby={errors.topic ? "topic-err" : "topic-help"}
          >
            <option value="" disabled>
              Válasszon témát…
            </option>
            {TOPIC_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.topic ? (
            <p id="topic-err" className={errBase}>
              {errors.topic}
            </p>
          ) : (
            <p id="topic-help" className="mt-1 text-sm text-black/55">
              A téma alapján a megfelelő kollégához továbbítjuk az üzenetet.
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="message" className={labelBase}>
          Üzenet <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className={inputBase}
          placeholder="Írja le röviden, miben segíthetünk."
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-err" : undefined}
        />
        {errors.message && (
          <p id="message-err" className={errBase}>
            {errors.message}
          </p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 rounded border-black/30 text-[var(--color-brand)] focus:ring-[var(--color-brand)]/30"
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? "consent-err" : undefined}
        />
        <label htmlFor="consent" className="text-sm text-black/80">
          Elfogadom az{" "}
          <a
            className="underline underline-offset-4 hover:text-[var(--color-brand)]"
            href="/adatkezelesi-tajekoztato"
            target="_blank"
            rel="noreferrer"
          >
            adatkezelési tájékoztatót
          </a>
          , és hozzájárulok, hogy a megadott adataimat a kérdésem
          megválaszolásához felhasználják.
        </label>
      </div>
      {errors.consent && (
        <p id="consent-err" className={errBase}>
          {errors.consent}
        </p>
      )}

      {status.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {status.message}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 disabled:opacity-70"
        >
          {status.kind === "submitting" ? "Küldés…" : "Küldés"}
        </button>
        <span className="text-sm text-black/60">
          Vagy közvetlenül:{" "}
          <a
            className="underline underline-offset-4 hover:text-[var(--color-brand)]"
            href="mailto:hirosablak@hirosablak.hu"
          >
            hirosablak@hirosablak.hu
          </a>
        </span>
      </div>
    </form>
  )
}
