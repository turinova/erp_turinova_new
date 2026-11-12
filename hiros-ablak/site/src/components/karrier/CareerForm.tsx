"use client"

import { useEffect, useRef, useState } from "react"
import {
  readStoredUtm,
  trackCareerApplyFail,
  trackCareerApplyStart,
  trackCareerApplyStep,
  trackCareerApplySubmit,
} from "@/lib/analytics"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type FieldErrors = Partial<{
  morningOk: string
  fullShiftOk: string
  saturdayOk: string
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
  /** A/B: ?cv=optional → CV nem kötelező */
  cvRequired?: boolean
}

type Step = 1 | 2 | 3

const STEPS = 3

const CV_MAX_BYTES = 5 * 1024 * 1024
const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const YES_NO = [
  { value: "yes", label: "Igen" },
  { value: "no", label: "Nem" },
] as const

const FULL_SHIFT_OPTIONS = [
  { value: "yes", label: "Igen, 17:00-ig" },
  { value: "no", label: "Sajnos korábban kellene mennem" },
] as const

const EXPERIENCE_OPTIONS = [
  { value: "bolt", label: "Igen, bolti vagy áruházi munka" },
  { value: "ugyfel", label: "Igen, más ügyfélkezelés" },
  { value: "none", label: "Még nincs, betanulnék" },
] as const

const START_OPTIONS = [
  { value: "immediate", label: "Azonnal" },
  { value: "2weeks", label: "2 héten belül" },
  { value: "1month", label: "1 hónapon belül" },
  { value: "later", label: "Később" },
] as const

const choiceLabel =
  "flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm font-medium text-black/85 has-[:checked]:border-[var(--color-brand)] has-[:checked]:bg-[var(--color-brand)]/5 has-[:checked]:ring-2 has-[:checked]:ring-[var(--color-brand)]/25 sm:text-base"

function ChoiceGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  name: string
  legend: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
  columns?: 1 | 2
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-black/80 sm:text-base">
        {legend} <span className="text-rose-600">*</span>
      </legend>
      <div
        className={`mt-2 grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {options.map((opt) => (
          <label key={opt.value} className={choiceLabel}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className="text-center leading-snug">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
    </fieldset>
  )
}

function StepProgress({ step }: { step: Step }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm text-black/55">
        <span className="font-medium text-black/70">
          {step}. lépés / {STEPS}
        </span>
        <span>
          {step === 1
            ? "Munkaidő"
            : step === 2
              ? "Tapasztalat"
              : "Jelentkezés"}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${
              n <= step ? "bg-[var(--color-brand)]" : "bg-black/10"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function CareerForm({
  jobSlug,
  phoneDisplay,
  phoneTel,
  cvRequired = true,
}: CareerFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const startedRef = useRef(false)

  const [morningOk, setMorningOk] = useState("")
  const [fullShiftOk, setFullShiftOk] = useState("")
  const [saturdayOk, setSaturdayOk] = useState("")
  const [experience, setExperience] = useState("")
  const [startWhen, setStartWhen] = useState("")
  const [lastJob, setLastJob] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [website, setWebsite] = useState("")

  useEffect(() => {
    readStoredUtm()
  }, [])

  function markStarted(nextStep: number) {
    if (!startedRef.current) {
      startedRef.current = true
      trackCareerApplyStart(jobSlug, nextStep)
    }
  }

  function validateStep(s: Step): FieldErrors {
    const next: FieldErrors = {}
    if (s === 1) {
      if (morningOk !== "yes" && morningOk !== "no") {
        next.morningOk = "Válassz: igen vagy nem."
      }
      if (fullShiftOk !== "yes" && fullShiftOk !== "no") {
        next.fullShiftOk = "Válaszd ki, végig ott tudsz-e lenni 17:00-ig."
      }
      if (saturdayOk !== "yes" && saturdayOk !== "no") {
        next.saturdayOk = "Válassz: igen vagy nem."
      }
    }
    if (s === 2) {
      if (!["bolt", "ugyfel", "none"].includes(experience)) {
        next.experience = "Válaszd ki a tapasztalatot."
      }
      if (!["immediate", "2weeks", "1month", "later"].includes(startWhen)) {
        next.startWhen = "Válaszd ki, mikor tudnál kezdeni."
      }
    }
    if (s === 3) {
      if (!name.trim()) next.name = "Add meg a neved."
      if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
        next.phone = "Add meg a telefonszámod (legalább 9 számjegy)."
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        next.email = "Ellenőrizd az e-mail címet."
      }
      if (!consent) next.consent = "Fogadd el az adatkezelési tájékoztatót."
      if (cvRequired && (!cvFile || cvFile.size === 0)) {
        next.cv = "Csatold az önéletrajzodat (PDF vagy Word)."
      } else if (cvFile && cvFile.size > 0) {
        if (cvFile.size > CV_MAX_BYTES) {
          next.cv = "Az önéletrajz max. 5 MB lehet."
        } else {
          const lower = cvFile.name.toLowerCase()
          const okExt =
            lower.endsWith(".pdf") ||
            lower.endsWith(".doc") ||
            lower.endsWith(".docx")
          if (!okExt) next.cv = "Csak PDF vagy Word fájl (DOC, DOCX)."
        }
      }
    }
    return next
  }

  function goNext() {
    const nextErrors = validateStep(step)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    markStarted(step)
    const fit =
      morningOk === "yes" && fullShiftOk === "yes" && saturdayOk === "yes"
        ? "yes"
        : "no"
    trackCareerApplyStep(jobSlug, step, {
      fit: step === 1 ? fit : undefined,
      experience: step === 2 ? experience : undefined,
      start_when: step === 2 ? startWhen : undefined,
    })

    setStep((s) => (s < 3 ? ((s + 1) as Step) : s))
  }

  function goBack() {
    setErrors({})
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step !== 3) {
      goNext()
      return
    }

    const nextErrors = validateStep(3)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (cvRequired && !cvFile) return

    markStarted(3)

    const fit: "yes" | "no" =
      morningOk === "yes" && fullShiftOk === "yes" && saturdayOk === "yes"
        ? "yes"
        : "no"
    const utm = readStoredUtm()

    const body = new FormData()
    body.set("form", "career")
    body.set("name", name.trim())
    body.set("phone", phone.trim())
    body.set("email", email.trim())
    body.set("topic", jobSlug)
    body.set("morningOk", morningOk)
    body.set("fullShiftOk", fullShiftOk)
    body.set("saturdayOk", saturdayOk)
    body.set("scheduleOk", fit)
    body.set("experience", experience)
    body.set("startWhen", startWhen)
    body.set("lastJob", lastJob.trim())
    body.set("consent", "true")
    body.set("website", website)
    if (!cvRequired) body.set("cvOptional", "true")
    if (utm.utm_source) body.set("utm_source", utm.utm_source)
    if (utm.utm_medium) body.set("utm_medium", utm.utm_medium)
    if (utm.utm_campaign) body.set("utm_campaign", utm.utm_campaign)
    if (utm.utm_content) body.set("utm_content", utm.utm_content)
    if (utm.utm_term) body.set("utm_term", utm.utm_term)
    if (cvFile && cvFile.size > 0) {
      body.set("cv", cvFile)
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
      trackCareerApplySubmit(jobSlug, fit)
      setStatus({ kind: "success" })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Hiba történt a küldés közben."
      trackCareerApplyFail(jobSlug, message.slice(0, 120))
      setStatus({ kind: "error", message })
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
          Általában egy munkanapon belül visszahívunk.
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
    "mt-1.5 block w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-black/90 placeholder:text-black/40 focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
  const errBase = "mt-1 text-sm text-rose-700"
  const btnPrimary =
    "inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 py-3 text-base font-semibold text-white hover:brightness-95 disabled:opacity-70"
  const btnSecondary =
    "inline-flex min-h-[48px] items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-base font-semibold text-black/80 hover:bg-black/[0.04]"

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <StepProgress step={step} />

      <div aria-hidden="true" className="hidden">
        <label>
          Ne töltse ki:
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {step === 1 && (
        <div className="grid gap-4">
          <ChoiceGroup
            name="morningOk"
            legend="Be tudsz érni hétköznap 7:30-ra?"
            options={YES_NO}
            value={morningOk}
            onChange={(v) => {
              markStarted(1)
              setMorningOk(v)
            }}
            error={errors.morningOk}
          />
          <ChoiceGroup
            name="fullShiftOk"
            legend="A műszak 17:00-ig tart. Végig ott tudsz lenni?"
            options={FULL_SHIFT_OPTIONS}
            value={fullShiftOk}
            onChange={(v) => {
              markStarted(1)
              setFullShiftOk(v)
            }}
            error={errors.fullShiftOk}
          />
          <ChoiceGroup
            name="saturdayOk"
            legend="Időnként szombaton 8:00-tól 12:00-ig is tudsz dolgozni?"
            options={YES_NO}
            value={saturdayOk}
            onChange={(v) => {
              markStarted(1)
              setSaturdayOk(v)
            }}
            error={errors.saturdayOk}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <ChoiceGroup
            name="experience"
            legend="Van bolti vagy ügyfélkezelési tapasztalatod?"
            options={EXPERIENCE_OPTIONS}
            value={experience}
            onChange={setExperience}
            error={errors.experience}
            columns={1}
          />
          <ChoiceGroup
            name="startWhen"
            legend="Mikor tudnál kezdeni?"
            options={START_OPTIONS}
            value={startWhen}
            onChange={setStartWhen}
            error={errors.startWhen}
          />
          <div>
            <label
              htmlFor="career-lastJob"
              className="text-sm font-medium text-black/80 sm:text-base"
            >
              Előző munkahely{" "}
              <span className="text-black/45">(nem kötelező)</span>
            </label>
            <input
              id="career-lastJob"
              name="lastJob"
              type="text"
              maxLength={160}
              value={lastJob}
              onChange={(e) => setLastJob(e.target.value)}
              className={inputBase}
              placeholder="Pl. barkácsáruház Kecskemét"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3.5">
          <div>
            <label
              htmlFor="career-name"
              className="text-sm font-medium text-black/80 sm:text-base"
            >
              Neved <span className="text-rose-600">*</span>
            </label>
            <input
              id="career-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              aria-invalid={!!errors.name}
              placeholder="Pl. Kovács Anna"
            />
            {errors.name && <p className={errBase}>{errors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="career-phone"
              className="text-sm font-medium text-black/80 sm:text-base"
            >
              Telefonszámod <span className="text-rose-600">*</span>
            </label>
            <input
              id="career-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputBase}
              aria-invalid={!!errors.phone}
              placeholder="+36 30 123 4567"
            />
            {errors.phone && <p className={errBase}>{errors.phone}</p>}
          </div>

          <div>
            <label
              htmlFor="career-email"
              className="text-sm font-medium text-black/80 sm:text-base"
            >
              E-mail <span className="text-black/45">(nem kötelező)</span>
            </label>
            <input
              id="career-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              aria-invalid={!!errors.email}
              placeholder="email@pelda.hu"
            />
            {errors.email && <p className={errBase}>{errors.email}</p>}
          </div>

          <div>
            <label
              htmlFor="career-cv"
              className="text-sm font-medium text-black/80 sm:text-base"
            >
              Önéletrajz{" "}
              {cvRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-black/45">(nem kötelező)</span>
              )}
            </label>
            <input
              id="career-cv"
              name="cv"
              type="file"
              accept={CV_ACCEPT}
              required={cvRequired}
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-brand)]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-brand)]"
              aria-invalid={!!errors.cv}
            />
            <p className="mt-1 text-sm text-black/55">
              {cvRequired
                ? "PDF vagy Word, max. 5 MB."
                : "Ha van, csatold. PDF vagy Word, max. 5 MB."}
              {cvFile ? ` ${cvFile.name}` : ""}
            </p>
            {errors.cv && <p className={errBase}>{errors.cv}</p>}
          </div>

          <div className="flex items-start gap-3 pt-1">
            <input
              id="career-consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
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
        </div>
      )}

      {status.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-900"
        >
          {status.message}
        </div>
      )}

      <div className="mt-1 flex gap-2">
        {step > 1 && (
          <button type="button" onClick={goBack} className={btnSecondary}>
            Vissza
          </button>
        )}
        {step < 3 ? (
          <button type="button" onClick={goNext} className={btnPrimary}>
            Tovább
          </button>
        ) : (
          <button
            type="submit"
            disabled={status.kind === "submitting"}
            className={btnPrimary}
          >
            {status.kind === "submitting" ? "Küldés…" : "Jelentkezem"}
          </button>
        )}
      </div>
    </form>
  )
}
