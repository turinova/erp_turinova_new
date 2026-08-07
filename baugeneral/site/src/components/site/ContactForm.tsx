"use client"

import Link from "next/link"
import { useState } from "react"
import { ProjectTypePicker } from "@/components/site/contact/ProjectTypePicker"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  name: string
  email: string
  phone: string
  projectType: string
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

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [messageLength, setMessageLength] = useState(0)

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validateEmailField(value: string) {
    if (!value.trim()) return "Adja meg az e-mail címét."
    if (!isValidEmail(value.trim())) return "Ellenőrizze az e-mail cím formátumát."
    return undefined
  }

  function validatePhoneField(value: string) {
    if (!value.trim()) return "Adja meg a telefonszámát."
    if (!isValidPhone(value.trim())) return "Ellenőrizze a telefonszámot."
    return undefined
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const payload = {
      form: "contact" as const,
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      company: String(data.get("company") || "").trim(),
      location: String(data.get("location") || "").trim(),
      projectType: String(data.get("projectType") || "").trim(),
      message: String(data.get("message") || "").trim(),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || "").trim(),
    }

    const nextErrors: FieldErrors = {}
    if (!payload.name) nextErrors.name = "Adja meg a nevét."
    const emailError = validateEmailField(payload.email)
    if (emailError) nextErrors.email = emailError
    const phoneError = validatePhoneField(payload.phone)
    if (phoneError) nextErrors.phone = phoneError
    if (!payload.projectType)
      nextErrors.projectType = "Válassza ki a projekt típusát."
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
          Hamarosan írunk e-mailben.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="form-field">
          <label htmlFor="name" className="form-label">
            Név <span className="form-label-required">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClass(!!errors.name)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-err" : undefined}
            placeholder="Pl. Kovács János"
            onInput={() => clearError("name")}
          />
          {errors.name ? (
            <p id="name-err" className="form-error" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="email" className="form-label">
            E-mail <span className="form-label-required">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass(!!errors.email)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-err" : undefined}
            placeholder="email@pelda.hu"
            onInput={() => clearError("email")}
            onBlur={(e) => {
              const err = validateEmailField(e.currentTarget.value)
              if (err) setErrors((prev) => ({ ...prev, email: err }))
            }}
          />
          {errors.email ? (
            <p id="email-err" className="form-error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="phone" className="form-label">
          Telefon <span className="form-label-required">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          inputMode="tel"
          className={inputClass(!!errors.phone)}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "phone-err" : undefined}
          placeholder="Pl. +36 70 123 4567"
          onInput={() => clearError("phone")}
          onBlur={(e) => {
            const err = validatePhoneField(e.currentTarget.value)
            if (err) setErrors((prev) => ({ ...prev, phone: err }))
          }}
        />
        {errors.phone ? (
          <p id="phone-err" className="form-error" role="alert">
            {errors.phone}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="form-field">
          <label htmlFor="company" className="form-label">
            Cégnév
            <span className="form-label-optional">opcionális</span>
          </label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            className="form-input"
            placeholder="Pl. Példa Kft."
          />
        </div>

        <div className="form-field">
          <label htmlFor="location" className="form-label">
            Település / megye
            <span className="form-label-optional">opcionális</span>
          </label>
          <input
            id="location"
            name="location"
            type="text"
            autoComplete="address-level2"
            className="form-input"
            placeholder="Pl. Kecskemét, Bács-Kiskun"
          />
        </div>
      </div>

      <ProjectTypePicker
        error={errors.projectType}
        onChange={() => clearError("projectType")}
      />

      <div className="form-field">
        <label htmlFor="message" className="form-label">
          Üzenet <span className="form-label-required">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={3}
          className={`${inputClass(!!errors.message)} form-textarea`}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-err" : undefined}
          placeholder="Pl. 1200 m² ipari csarnok, Kecskemét, átadás 2027"
          onInput={(e) => {
            setMessageLength(e.currentTarget.value.length)
            clearError("message")
          }}
        />
        {messageLength > 0 && messageLength < 10 ? (
          <p id="message-hint" className="form-helper">
            Minimum 10 karakter.
          </p>
        ) : null}
        {errors.message ? (
          <p id="message-err" className="form-error" role="alert">
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
            aria-describedby={errors.consent ? "consent-err" : undefined}
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
          <p id="consent-err" className="form-error" role="alert">
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
