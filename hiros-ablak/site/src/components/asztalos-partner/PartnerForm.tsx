"use client"

import { useState } from "react"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "pending_integration" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  name: string
  email: string
  phone: string
}>

type PartnerFormProps = {
  phoneDisplay: string
  phoneTel: string
  email: string
}

export default function PartnerForm({
  phoneDisplay,
  phoneTel,
  email,
}: PartnerFormProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const payload = {
      name: String(data.get("name") || "").trim(),
      company: String(data.get("company") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      message: String(data.get("message") || "").trim(),
    }

    const nextErrors: FieldErrors = {}
    if (!payload.name) nextErrors.name = "Add meg a neved."
    if (!payload.phone) nextErrors.phone = "Add meg a telefonszámod, hogy visszahívhassunk."
    if (!payload.email) nextErrors.email = "Add meg az e-mail címed."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
      nextErrors.email = "Ellenőrizd az e-mail cím formátumát."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setStatus({ kind: "submitting" })
    setTimeout(() => {
      setStatus({ kind: "pending_integration" })
    }, 400)
  }

  if (status.kind === "pending_integration") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <div className="text-lg font-semibold text-emerald-900">
          Köszönjük, megkaptuk!
        </div>
        <p className="mt-2 text-sm text-emerald-900/85 leading-relaxed">
          Az online űrlap funkció hamarosan elérhető lesz. Addig is hívj minket
          munkanap 8 és 17 óra között, vagy írj e-mailt.
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <a
            className="font-semibold text-emerald-900 underline underline-offset-4 hover:brightness-90"
            href={phoneTel}
          >
            Telefon: {phoneDisplay}
          </a>
          <a
            className="font-semibold text-emerald-900 underline underline-offset-4 hover:brightness-90"
            href={`mailto:${email}`}
          >
            E-mail: {email}
          </a>
        </div>
        <button
          type="button"
          className="mt-5 inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="partner-name" className={labelBase}>
            Név <span className="text-rose-600">*</span>
          </label>
          <input
            id="partner-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
            aria-invalid={!!errors.name}
            placeholder="Pl. Kovács János"
          />
          {errors.name && <p className={errBase}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="partner-company" className={labelBase}>
            Vállalkozás neve{" "}
            <span className="text-black/45">(nem kötelező)</span>
          </label>
          <input
            id="partner-company"
            name="company"
            type="text"
            autoComplete="organization"
            className={inputBase}
            placeholder="Pl. Kovács Asztalos Bt."
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="partner-phone" className={labelBase}>
            Telefon <span className="text-rose-600">*</span>
          </label>
          <input
            id="partner-phone"
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
        <div>
          <label htmlFor="partner-email" className={labelBase}>
            E-mail <span className="text-rose-600">*</span>
          </label>
          <input
            id="partner-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputBase}
            aria-invalid={!!errors.email}
            placeholder="email@pelda.hu"
          />
          {errors.email && <p className={errBase}>{errors.email}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="partner-message" className={labelBase}>
          Mire van szükséged?{" "}
          <span className="text-black/45">(nem kötelező)</span>
        </label>
        <textarea
          id="partner-message"
          name="message"
          rows={4}
          className={inputBase}
          placeholder="Pl. heti 1-2 lapszabászati projekt, néha vasalat, élzárás minden vastagságban."
        />
        <p className="mt-1 text-sm text-black/55">
          Pár mondat is elég. A részleteket a beszélgetésen átvesszük.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 disabled:opacity-70"
        >
          {status.kind === "submitting" ? "Küldés…" : "Visszahívást kérek"}
        </button>
        <span className="text-sm text-black/60">
          Munkanapokon néhány órán belül visszajelzünk.
        </span>
      </div>

      <p className="text-xs text-black/55">
        A telefonszámodat csak a visszahíváshoz használjuk. Hírlevelet,
        reklámot nem küldünk.
      </p>
    </form>
  )
}
