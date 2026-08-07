"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SZAKAGI_FORM_TRADES } from "@/lib/szakagi-landing"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  name: string
  email: string
  phone: string
  location: string
  trade: string
  message: string
  consent: string
}>

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 8 && digits.length <= 15
}

function inputClass(hasError: boolean) {
  return `form-input${hasError ? " form-input--error" : ""}`
}

const TRADE_IDS: ReadonlySet<string> = new Set(SZAKAGI_FORM_TRADES.map((t) => t.id))

type SzakagiContactFormProps = {
  /** Unique prefix when mounting the form more than once on a page */
  idPrefix?: string
}

function SzakagiContactFormInner({ idPrefix = "szakagi" }: SzakagiContactFormProps) {
  const searchParams = useSearchParams()
  const tradeFromUrl = searchParams.get("szakag") ?? ""
  const initialTrade = TRADE_IDS.has(tradeFromUrl) ? tradeFromUrl : ""

  const [trade, setTrade] = useState(initialTrade)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [messageLength, setMessageLength] = useState(0)

  const ids = {
    trade: `${idPrefix}-trade`,
    name: `${idPrefix}-name`,
    phone: `${idPrefix}-phone`,
    email: `${idPrefix}-email`,
    location: `${idPrefix}-location`,
    message: `${idPrefix}-message`,
    consent: `${idPrefix}-consent`,
  }

  useEffect(() => {
    if (TRADE_IDS.has(tradeFromUrl)) {
      setTrade(tradeFromUrl)
    }
  }, [tradeFromUrl])

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const payload = {
      form: "szakagi" as const,
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      location: String(data.get("location") || "").trim(),
      trade: String(data.get("trade") || "").trim(),
      message: String(data.get("message") || "").trim(),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || "").trim(),
    }

    const nextErrors: FieldErrors = {}
    if (!payload.name) nextErrors.name = "Adja meg a nevét."
    if (!payload.phone) nextErrors.phone = "Adja meg a telefonszámát."
    else if (!isValidPhone(payload.phone))
      nextErrors.phone = "Ellenőrizze a telefonszámot."
    if (payload.email && !isValidEmail(payload.email))
      nextErrors.email = "Ellenőrizze az e-mail cím formátumát."
    if (!payload.location) nextErrors.location = "Adja meg a helyszínt."
    if (!payload.trade) nextErrors.trade = "Válassza ki a szakágat."
    if (!payload.message || payload.message.length < 10)
      nextErrors.message = "Az üzenet legalább 10 karakter legyen."
    if (!payload.consent)
      nextErrors.consent = "Fogadja el az adatkezelési tájékoztatót."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      setStatus({ kind: "submitting" })
      const res = await fetch("/api/forms", {
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
      setTrade("")
      setMessageLength(0)
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Hiba történt a küldés közben.",
      })
    }
  }

  if (status.kind === "success") {
    return (
      <div role="status" className="form-success">
        <div className="text-lg font-semibold text-black/88">Köszönjük, megkaptuk.</div>
        <p className="mt-2 text-sm leading-relaxed text-black/65">
          Egy munkanapon belül jelentkezünk.
        </p>
        <button
          type="button"
          className="btn-secondary mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Új üzenet
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div aria-hidden="true" className="hidden">
        <label>
          Ne töltse ki:
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="form-field">
        <label htmlFor={ids.trade} className="form-label">
          Szakág <span className="form-label-required">*</span>
        </label>
        <select
          id={ids.trade}
          name="trade"
          required
          value={trade}
          className={inputClass(!!errors.trade)}
          aria-invalid={!!errors.trade}
          aria-describedby={errors.trade ? `${ids.trade}-err` : undefined}
          onChange={(e) => {
            setTrade(e.target.value)
            clearError("trade")
          }}
        >
          <option value="">Válasszon szakágat</option>
          {SZAKAGI_FORM_TRADES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {errors.trade ? (
          <p id={`${ids.trade}-err`} className="form-error" role="alert">
            {errors.trade}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="form-field">
          <label htmlFor={ids.name} className="form-label">
            Név <span className="form-label-required">*</span>
          </label>
          <input
            id={ids.name}
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClass(!!errors.name)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${ids.name}-err` : undefined}
            placeholder="Pl. Kovács János"
            onInput={() => clearError("name")}
          />
          {errors.name ? (
            <p id={`${ids.name}-err`} className="form-error" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor={ids.phone} className="form-label">
            Telefon <span className="form-label-required">*</span>
          </label>
          <input
            id={ids.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            inputMode="tel"
            className={inputClass(!!errors.phone)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? `${ids.phone}-err` : undefined}
            placeholder="Pl. +36 70 123 4567"
            onInput={() => clearError("phone")}
          />
          {errors.phone ? (
            <p id={`${ids.phone}-err`} className="form-error" role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="form-field">
          <label htmlFor={ids.email} className="form-label">
            E-mail
            <span className="form-label-optional">opcionális</span>
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            className={inputClass(!!errors.email)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${ids.email}-err` : undefined}
            placeholder="email@pelda.hu"
            onInput={() => clearError("email")}
          />
          {errors.email ? (
            <p id={`${ids.email}-err`} className="form-error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor={ids.location} className="form-label">
            Helyszín <span className="form-label-required">*</span>
          </label>
          <input
            id={ids.location}
            name="location"
            type="text"
            autoComplete="address-level2"
            required
            className={inputClass(!!errors.location)}
            aria-invalid={!!errors.location}
            aria-describedby={
              errors.location ? `${ids.location}-err` : undefined
            }
            placeholder="Pl. Kecskemét, Bács-Kiskun"
            onInput={() => clearError("location")}
          />
          {errors.location ? (
            <p id={`${ids.location}-err`} className="form-error" role="alert">
              {errors.location}
            </p>
          ) : null}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={ids.message} className="form-label">
          Rövid leírás <span className="form-label-required">*</span>
        </label>
        <textarea
          id={ids.message}
          name="message"
          required
          rows={3}
          className={`${inputClass(!!errors.message)} form-textarea`}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? `${ids.message}-err` : undefined}
          placeholder="Pl. udvari térkövezés, kb. 80 m², ősszel"
          onInput={(e) => {
            setMessageLength(e.currentTarget.value.length)
            clearError("message")
          }}
        />
        {messageLength > 0 && messageLength < 10 ? (
          <p className="form-helper">Minimum 10 karakter.</p>
        ) : null}
        {errors.message ? (
          <p id={`${ids.message}-err`} className="form-error" role="alert">
            {errors.message}
          </p>
        ) : null}
      </div>

      <div className="form-field">
        <label className="form-consent">
          <input
            type="checkbox"
            name="consent"
            required
            className="form-consent__control"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? `${ids.consent}-err` : undefined}
            onChange={() => clearError("consent")}
          />
          <span className="form-consent__text">
            Elfogadom az{" "}
            <Link
              href="/adatkezelesi-tajekoztato"
              className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
            >
              adatkezelési tájékoztatót
            </Link>
            . <span className="form-label-required">*</span>
          </span>
        </label>
        {errors.consent ? (
          <p id={`${ids.consent}-err`} className="form-error" role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>

      {status.kind === "error" ? (
        <p role="alert" className="form-error">
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="btn-primary inline-flex w-full justify-center px-6 py-3 text-sm font-semibold disabled:opacity-60 sm:w-auto"
      >
        {status.kind === "submitting" ? "Küldés…" : "Üzenet elküldése"}
      </button>
    </form>
  )
}

function FormFallback() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-black/10 bg-white p-6 text-sm text-black/55">
      Űrlap betöltése…
    </div>
  )
}

export function SzakagiContactForm({ idPrefix = "szakagi" }: SzakagiContactFormProps) {
  return (
    <Suspense fallback={<FormFallback />}>
      <SzakagiContactFormInner idPrefix={idPrefix} />
    </Suspense>
  )
}
