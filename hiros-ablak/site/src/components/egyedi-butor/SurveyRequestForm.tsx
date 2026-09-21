"use client"

import { useState } from "react"
import { FURNITURE_TYPES } from "@/lib/egyedi-butor-data"
import { analyticsEvent } from "@/lib/analytics"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  name: string
  phone: string
  company: string
  topic: string
  consent: string
}>

type SurveyRequestFormProps = {
  phoneDisplay: string
  phoneTel: string
  email: string
  /** Prefill from ?tipus= query — remount parent with key when this changes */
  defaultType?: string
  idPrefix?: string
  compact?: boolean
}

export default function SurveyRequestForm({
  phoneDisplay,
  phoneTel,
  email,
  defaultType = "",
  idPrefix = "felmeres",
  compact = false,
}: SurveyRequestFormProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [topic, setTopic] = useState(defaultType)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const payload = {
      form: "felmeres" as const,
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: "",
      company: String(data.get("company") || "").trim(),
      topic: String(data.get("topic") || "").trim(),
      message: "",
      consent: data.get("consent") === "on",
      website: String(data.get("website") || "").trim(),
    }

    const nextErrors: FieldErrors = {}
    if (!payload.name) nextErrors.name = "Adja meg a nevét."
    if (!payload.phone)
      nextErrors.phone = "Adja meg a telefonszámát, hogy visszahívhassuk."
    else if (payload.phone.replace(/\D/g, "").length < 9)
      nextErrors.phone = "Ellenőrizze a telefonszámot."
    if (payload.company.length < 8)
      nextErrors.company = "Adja meg a település, az utca és a házszám adatait."
    else if (!/\d/.test(payload.company))
      nextErrors.company = "Az utcát és a házszámot is adja meg."
    if (!payload.topic) nextErrors.topic = "Válassza ki, mit tervez."
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
        throw new Error(
          j?.error ||
            "Nem sikerült elküldeni. Kérjük, próbálja újra, vagy hívjon minket.",
        )
      }
      setStatus({ kind: "success" })
      form.reset()
      setTopic("")
      analyticsEvent("felmeres_submit", {
        furniture_type: payload.topic,
        form_id: idPrefix,
      })
      analyticsEvent("generate_lead", {
        currency: "HUF",
        value: 0,
        lead_type: "helyszini_felmeres",
        furniture_type: payload.topic,
      })
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Nem sikerült elküldeni. Kérjük, próbálja újra, vagy hívjon minket.",
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
          Köszönjük, megkaptuk.
        </div>
        <p className="mt-2 text-sm text-emerald-900/85 leading-relaxed">
          Egy munkanapon belül hívjuk, és egyeztetünk egy időpontot. Ha előbb
          beszélne velünk, hívjon hétköznap 8 és 17 óra között.
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <a
            className="font-semibold text-emerald-900 underline underline-offset-4"
            href={phoneTel}
          >
            {phoneDisplay}
          </a>
          <a
            className="font-semibold text-emerald-900 underline underline-offset-4"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </div>
        <button
          type="button"
          className="mt-5 inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Másik felmérést kérek
        </button>
      </div>
    )
  }

  const inputBase =
    "block w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-black/90 placeholder:text-black/40 focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 transition"
  const labelBase = "block text-sm font-medium text-black/80"
  const errBase = "mt-1 text-sm text-rose-700"

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      <div aria-hidden="true" className="hidden">
        <label>
          Ne töltse ki:
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className={compact ? "grid gap-3.5" : "grid gap-3.5 sm:grid-cols-2"}>
        <div>
          <label htmlFor={`${idPrefix}-name`} className={labelBase}>
            Név <span className="text-rose-600">*</span>
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className={errBase}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-phone`} className={labelBase}>
            Telefonszám <span className="text-rose-600">*</span>
          </label>
          <input
            id={`${idPrefix}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            className={inputBase}
            aria-invalid={!!errors.phone}
            placeholder="+36 30 123 4567"
          />
          {errors.phone && <p className={errBase}>{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-company`} className={labelBase}>
          A felmérés helyszíne <span className="text-rose-600">*</span>
        </label>
        <input
          id={`${idPrefix}-company`}
          name="company"
          type="text"
          autoComplete="street-address"
          required
          className={inputBase}
          aria-invalid={!!errors.company}
          aria-describedby={`${idPrefix}-company-hint`}
          placeholder="1026 Budapest, Csaba utca 12."
        />
        {errors.company ? (
          <p className={errBase}>{errors.company}</p>
        ) : (
          <p
            id={`${idPrefix}-company-hint`}
            className="mt-1 text-xs leading-relaxed text-black/50"
          >
            Az utcát és a házszámot is kérjük, így a felmérő fel tud készülni. A
            címet csak ehhez használjuk.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-topic`} className={labelBase}>
          Mit tervez? <span className="text-rose-600">*</span>
        </label>
        <select
          id={`${idPrefix}-topic`}
          name="topic"
          required
          className={inputBase}
          aria-invalid={!!errors.topic}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="" disabled>
            Válasszon
          </option>
          {FURNITURE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {errors.topic && <p className={errBase}>{errors.topic}</p>}
      </div>

      <div className="flex items-start gap-3">
        <input
          id={`${idPrefix}-consent`}
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 rounded border-black/30 text-[var(--color-brand)] focus:ring-[var(--color-brand)]/30"
          aria-invalid={!!errors.consent}
        />
        <label
          htmlFor={`${idPrefix}-consent`}
          className="text-sm text-black/80 leading-snug"
        >
          Elolvastam az{" "}
          <a
            className="underline underline-offset-4 hover:text-[var(--color-brand)]"
            href="/adatkezelesi-tajekoztato"
            target="_blank"
            rel="noreferrer"
          >
            adatkezelési tájékoztatót
          </a>
          , és kérem a visszahívást.
        </label>
      </div>
      {errors.consent && <p className={errBase}>{errors.consent}</p>}

      {status.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3.5 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 disabled:opacity-70 shadow-[0_8px_28px_rgba(151,29,37,0.28)] transition"
      >
        {status.kind === "submitting" ? "Küldés" : "Kérem a felmérést"}
      </button>
      <p className="text-xs text-black/55 text-center">
        Nem kötelez semmire. Hírlevelet nem küldünk.
      </p>
    </form>
  )
}
