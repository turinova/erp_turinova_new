"use client"

import { useState } from "react"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  scheduleOk: string
  experience: string
  startWhen: string
  name: string
  phone: string
  email: string
  cv: string
  consent: string
}>

type CareerFormProps = {
  jobSlug: string
  phoneDisplay: string
  phoneTel: string
}

const CV_MAX_BYTES = 5 * 1024 * 1024
const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const SCHEDULE_OPTIONS = [
  { value: "yes", label: "Igen" },
  { value: "no", label: "Nem" },
] as const

const EXPERIENCE_OPTIONS = [
  { value: "elzaro", label: "Igen, élzáró / faipari gép" },
  { value: "other", label: "Igen, más gyártógép" },
  { value: "none", label: "Még nincs, betanulnék" },
] as const

const START_OPTIONS = [
  { value: "immediate", label: "Azonnal" },
  { value: "2weeks", label: "2 héten belül" },
  { value: "1month", label: "1 hónapon belül" },
  { value: "later", label: "Később" },
] as const

function ChoiceGroup({
  name,
  legend,
  options,
  error,
}: {
  name: string
  legend: string
  options: readonly { value: string; label: string }[]
  error?: string
}) {
  return (
    <fieldset>
      <legend className="text-base font-medium text-black/80">
        {legend} <span className="text-rose-600">*</span>
      </legend>
      <div className="mt-2 grid gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-black/85 has-[:checked]:border-[var(--color-brand)] has-[:checked]:bg-[var(--color-brand)]/5 has-[:checked]:ring-2 has-[:checked]:ring-[var(--color-brand)]/25"
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              required
              className="h-5 w-5 shrink-0 border-black/30 text-[var(--color-brand)] focus:ring-[var(--color-brand)]/30"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
    </fieldset>
  )
}

export default function CareerForm({
  jobSlug,
  phoneDisplay,
  phoneTel,
}: CareerFormProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const scheduleOk = String(data.get("scheduleOk") || "").trim()
    const experience = String(data.get("experience") || "").trim()
    const startWhen = String(data.get("startWhen") || "").trim()
    const lastJob = String(data.get("lastJob") || "").trim()
    const name = String(data.get("name") || "").trim()
    const phone = String(data.get("phone") || "").trim()
    const email = String(data.get("email") || "").trim()
    const consent = data.get("consent") === "on"
    const website = String(data.get("website") || "").trim()
    const cv = data.get("cv")

    const nextErrors: FieldErrors = {}
    if (scheduleOk !== "yes" && scheduleOk !== "no") {
      nextErrors.scheduleOk = "Válassz: igen vagy nem."
    }
    if (!["elzaro", "other", "none"].includes(experience)) {
      nextErrors.experience = "Válaszd ki a tapasztalatot."
    }
    if (!["immediate", "2weeks", "1month", "later"].includes(startWhen)) {
      nextErrors.startWhen = "Válaszd ki, mikor tudnál kezdeni."
    }
    if (!name) nextErrors.name = "Add meg a neved."
    if (!phone) nextErrors.phone = "Add meg a telefonszámod."
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Ellenőrizd az e-mail címet."
    }
    if (!consent) nextErrors.consent = "Fogadd el az adatkezelési tájékoztatót."

    if (cv instanceof File && cv.size > 0) {
      if (cv.size > CV_MAX_BYTES) {
        nextErrors.cv = "Az önéletrajz max. 5 MB lehet."
      } else {
        const lower = cv.name.toLowerCase()
        const okExt =
          lower.endsWith(".pdf") ||
          lower.endsWith(".doc") ||
          lower.endsWith(".docx")
        if (!okExt) nextErrors.cv = "Csak PDF vagy Word fájl (DOC, DOCX)."
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const body = new FormData()
    body.set("form", "career")
    body.set("name", name)
    body.set("phone", phone)
    body.set("email", email)
    body.set("topic", jobSlug)
    body.set("scheduleOk", scheduleOk)
    body.set("experience", experience)
    body.set("startWhen", startWhen)
    body.set("lastJob", lastJob)
    body.set("consent", "true")
    body.set("website", website)
    if (cv instanceof File && cv.size > 0) {
      body.set("cv", cv)
    }

    try {
      setStatus({ kind: "submitting" })
      const res = await fetch("/api/forms", {
        method: "POST",
        body,
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
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
      >
        <p className="text-lg font-semibold text-emerald-900">
          Köszi! Megkaptuk.
        </p>
        <p className="mt-2 text-base text-emerald-900/85">
          Telefonon keresünk.
        </p>
        <a
          href={phoneTel}
          className="mt-4 inline-block text-base font-semibold text-emerald-900 underline underline-offset-4"
        >
          Hívj: {phoneDisplay}
        </a>
      </div>
    )
  }

  const inputBase =
    "mt-1.5 block w-full rounded-xl border border-black/15 bg-white px-4 py-3.5 text-lg text-black/90 placeholder:text-black/40 focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
  const errBase = "mt-1 text-sm text-rose-700"

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div aria-hidden="true" className="hidden">
        <label>
          Ne töltse ki:
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <ChoiceGroup
        name="scheduleOk"
        legend="Neked jó a munkaidő: hétfő–péntek, 8–17, Kecskemét?"
        options={SCHEDULE_OPTIONS}
        error={errors.scheduleOk}
      />

      <ChoiceGroup
        name="experience"
        legend="Van már gép- vagy üzemi tapasztalatod?"
        options={EXPERIENCE_OPTIONS}
        error={errors.experience}
      />

      <ChoiceGroup
        name="startWhen"
        legend="Mikor tudnál kezdeni?"
        options={START_OPTIONS}
        error={errors.startWhen}
      />

      <div>
        <label htmlFor="career-lastJob" className="text-base font-medium text-black/80">
          Előző munkahelyed, ha van{" "}
          <span className="text-black/45">(nem kötelező)</span>
        </label>
        <input
          id="career-lastJob"
          name="lastJob"
          type="text"
          maxLength={160}
          className={inputBase}
          placeholder="Pl. bútorüzem Kecskemét"
        />
      </div>

      <div className="border-t border-black/10 pt-5">
        <div>
          <label htmlFor="career-name" className="text-base font-medium text-black/80">
            Neved <span className="text-rose-600">*</span>
          </label>
          <input
            id="career-name"
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

        <div className="mt-4">
          <label htmlFor="career-phone" className="text-base font-medium text-black/80">
            Telefonszámod <span className="text-rose-600">*</span>
          </label>
          <input
            id="career-phone"
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

        <div className="mt-4">
          <label htmlFor="career-email" className="text-base font-medium text-black/80">
            E-mail{" "}
            <span className="text-black/45">(nem kötelező)</span>
          </label>
          <input
            id="career-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputBase}
            aria-invalid={!!errors.email}
            placeholder="email@pelda.hu"
          />
          {errors.email && <p className={errBase}>{errors.email}</p>}
        </div>

        <div className="mt-4">
          <label htmlFor="career-cv" className="text-base font-medium text-black/80">
            Önéletrajz{" "}
            <span className="text-black/45">(nem kötelező)</span>
          </label>
          <input
            id="career-cv"
            name="cv"
            type="file"
            accept={CV_ACCEPT}
            className="mt-1.5 block w-full text-base text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-brand)]/10 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[var(--color-brand)]"
            aria-invalid={!!errors.cv}
          />
          <p className="mt-1.5 text-sm text-black/55">
            Ha van, csatold. Ha nincs, semmi gond. PDF vagy Word, max. 5 MB.
          </p>
          {errors.cv && <p className={errBase}>{errors.cv}</p>}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="career-consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 rounded border-black/30 text-[var(--color-brand)] focus:ring-[var(--color-brand)]/30"
          aria-invalid={!!errors.consent}
        />
        <label htmlFor="career-consent" className="text-sm text-black/75">
          Elfogadom az{" "}
          <a
            className="underline underline-offset-4 hover:text-[var(--color-brand)]"
            href="/adatkezelesi-tajekoztato"
            target="_blank"
            rel="noreferrer"
          >
            adatkezelési tájékoztatót
          </a>
          .
        </label>
      </div>
      {errors.consent && <p className={errBase}>{errors.consent}</p>}

      {status.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-900"
        >
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3.5 text-lg font-semibold text-white hover:brightness-95 disabled:opacity-70"
      >
        {status.kind === "submitting" ? "Küldés…" : "Jelentkezem"}
      </button>
    </form>
  )
}
