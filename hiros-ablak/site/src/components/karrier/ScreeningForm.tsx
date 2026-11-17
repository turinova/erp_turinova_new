"use client"

import { useState } from "react"
import {
  SCREENING_ENERGY,
  SCREENING_EXPERIENCE,
  SCREENING_SCALE_VALUES,
  SCREENING_START,
  SCREENING_YES_NO,
  SITU_MAX_CHARS,
  SITU_MIN_CHARS,
  formatHuPhoneDisplay,
  formatSalaryDisplay,
  huPhoneNationalDigits,
  isValidScreeningEmail,
  parseSalaryNumber,
} from "@/lib/career-screening"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

type Step = 1 | 2 | 3

type FieldErrors = Partial<Record<string, string>>

type ScreeningFormProps = {
  phoneDisplay: string
  phoneTel: string
}

const STEPS = 3

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
  columns?: 1 | 2 | 5
}) {
  const colClass =
    columns === 5
      ? "grid-cols-5"
      : columns === 1
        ? "grid-cols-1"
        : "grid-cols-2"
  return (
    <fieldset>
      <legend className="text-sm font-medium text-black/80 sm:text-base">
        {legend} <span className="text-rose-600">*</span>
      </legend>
      <div className={`mt-2 grid gap-2 ${colClass}`}>
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
            ? "Adatok és műszak"
            : step === 2
              ? "Hogyan dolgozol"
              : "Bolti helyzetek"}
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

const SCALE_OPTIONS = SCREENING_SCALE_VALUES.map((v) => ({
  value: v,
  label: v,
}))

function CharHint({ value }: { value: string }) {
  const len = value.trim().length
  const ok = len >= SITU_MIN_CHARS
  return (
    <p
      className={`mt-1 text-xs ${ok ? "text-black/45" : "text-amber-800"}`}
    >
      {len} / min. {SITU_MIN_CHARS} karakter
      {ok ? "" : " — ennyi után lehet továbblépni / beküldeni"}
      {" · "}max. {SITU_MAX_CHARS}
    </p>
  )
}

export default function ScreeningForm({
  phoneDisplay,
  phoneTel,
}: ScreeningFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [errors, setErrors] = useState<FieldErrors>({})

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [salaryNet, setSalaryNet] = useState("")
  const [startWhen, setStartWhen] = useState("")
  const [morningOk, setMorningOk] = useState("")
  const [fullShiftOk, setFullShiftOk] = useState("")
  const [saturdayOk, setSaturdayOk] = useState("")
  const [commuteOk, setCommuteOk] = useState("")

  const [scaleCustomer, setScaleCustomer] = useState("")
  const [scaleEnergy, setScaleEnergy] = useState("")
  const [scalePunctual, setScalePunctual] = useState("")
  const [scaleMoney, setScaleMoney] = useState("")
  const [scaleAdmin, setScaleAdmin] = useState("")
  const [scaleCalm, setScaleCalm] = useState("")
  const [scalePatience, setScalePatience] = useState("")

  const [situTriple, setSituTriple] = useState("")
  const [situAngry, setSituAngry] = useState("")
  const [situCash, setSituCash] = useState("")
  const [situLate, setSituLate] = useState("")
  const [situLikeDislike, setSituLikeDislike] = useState("")
  const [experience, setExperience] = useState("")
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("")

  function validateStep(s: Step): FieldErrors {
    const next: FieldErrors = {}
    if (s === 1) {
      if (!name.trim()) next.name = "Add meg a neved."
      if (!isValidScreeningEmail(email)) {
        next.email = "Érvényes e-mail címet adj meg (pl. nev@email.hu)."
      }
      if (huPhoneNationalDigits(phone).length < 9) {
        next.phone = "Add meg a számot: +36 30 132 9999 formában."
      }
      const salary = parseSalaryNumber(salaryNet)
      if (!Number.isFinite(salary) || salary < 100000) {
        next.salaryNet = "Csak számot írj (pl. 350 000)."
      }
      if (!["immediate", "2weeks", "1month", "later"].includes(startWhen)) {
        next.startWhen = "Válaszd ki, mikor tudnál kezdeni."
      }
      if (morningOk !== "yes" && morningOk !== "no") {
        next.morningOk = "Válassz: igen vagy nem."
      }
      if (fullShiftOk !== "yes" && fullShiftOk !== "no") {
        next.fullShiftOk = "Válassz: igen vagy nem."
      }
      if (saturdayOk !== "yes" && saturdayOk !== "no") {
        next.saturdayOk = "Válassz: igen vagy nem."
      }
      if (commuteOk !== "yes" && commuteOk !== "no") {
        next.commuteOk = "Válassz: igen vagy nem."
      }
    }
    if (s === 2) {
      for (const [key, val, label] of [
        ["scaleCustomer", scaleCustomer, "ügyfélkontakt"],
        ["scalePunctual", scalePunctual, "pontosság"],
        ["scaleMoney", scaleMoney, "pénz/bizonylat"],
        ["scaleAdmin", scaleAdmin, "adminisztráció"],
        ["scaleCalm", scaleCalm, "nyugalom"],
        ["scalePatience", scalePatience, "türelem"],
      ] as const) {
        if (!["1", "2", "3", "4", "5"].includes(val)) {
          next[key] = `Válassz 1–5 között (${label}).`
        }
      }
      if (!["up", "down"].includes(scaleEnergy)) {
        next.scaleEnergy = "Válaszd ki: feltölt vagy kimerít."
      }
    }
    if (s === 3) {
      for (const [key, val] of [
        ["situTriple", situTriple],
        ["situAngry", situAngry],
        ["situCash", situCash],
        ["situLate", situLate],
        ["situLikeDislike", situLikeDislike],
      ] as const) {
        const len = val.trim().length
        if (len < SITU_MIN_CHARS) {
          next[key] = `Legalább ${SITU_MIN_CHARS} karakter kell (most: ${len}).`
        } else if (len > SITU_MAX_CHARS) {
          next[key] = `Maximum ${SITU_MAX_CHARS} karakter.`
        }
      }
      if (!["bolt", "ugyfel", "none"].includes(experience)) {
        next.experience = "Válaszd ki a tapasztalatot."
      }
      if (!consent) next.consent = "Fogadd el az adatkezelési tájékoztatót."
    }
    return next
  }

  function goNext() {
    const nextErrors = validateStep(step)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s))
  }

  function goBack() {
    setErrors({})
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step !== 3) {
      goNext()
      return
    }
    const nextErrors = validateStep(3)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      setStatus({ kind: "submitting" })
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: "career_screening",
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: formatHuPhoneDisplay(phone) || phone.trim(),
          salaryNet: String(parseSalaryNumber(salaryNet) || ""),
          startWhen,
          morningOk,
          fullShiftOk,
          saturdayOk,
          commuteOk,
          scaleCustomer,
          scaleEnergy,
          scalePunctual,
          scaleMoney,
          scaleAdmin,
          scaleCalm,
          scalePatience,
          situTriple: situTriple.trim().slice(0, SITU_MAX_CHARS),
          situAngry: situAngry.trim().slice(0, SITU_MAX_CHARS),
          situCash: situCash.trim().slice(0, SITU_MAX_CHARS),
          situLate: situLate.trim().slice(0, SITU_MAX_CHARS),
          situLikeDislike: situLikeDislike.trim().slice(0, SITU_MAX_CHARS),
          experience,
          consent: true,
          website,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Hiba történt a küldés közben.")
      }
      setStatus({ kind: "success" })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Hiba történt a küldés közben."
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
          Köszi! Megkaptuk a válaszaid.
        </p>
        <p className="mt-2 text-base text-emerald-900/85">
          A megfelelő jelentkezőkkel egyeztetünk személyes beszélgetést.
        </p>
        <a
          href={phoneTel}
          className="mt-4 inline-block text-base font-semibold text-emerald-900 underline underline-offset-4"
        >
          Telefon: {phoneDisplay}
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
  const textareaBase = `${inputBase} min-h-[96px] resize-y`

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
          <p className="text-sm text-black/60">
            Elérhetőség, bérigény és a munkaidő vállalása.
          </p>
          <div>
            <label htmlFor="sc-name" className="text-sm font-medium text-black/80">
              Név <span className="text-rose-600">*</span>
            </label>
            <input
              id="sc-name"
              className={inputBase}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            {errors.name && <p className={errBase}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="sc-email" className="text-sm font-medium text-black/80">
              E-mail <span className="text-rose-600">*</span>
            </label>
            <input
              id="sc-email"
              type="email"
              inputMode="email"
              className={inputBase}
              placeholder="nev@email.hu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.replace(/\s/g, ""))
                setErrors((prev) => {
                  if (!prev.email) return prev
                  const { email: _e, ...rest } = prev
                  return rest
                })
              }}
              onBlur={(e) => {
                const v = e.target.value.trim().toLowerCase()
                setEmail(v)
                if (v && !isValidScreeningEmail(v)) {
                  setErrors((prev) => ({
                    ...prev,
                    email: "Érvényes e-mail címet adj meg (pl. nev@email.hu).",
                  }))
                }
              }}
              autoComplete="email"
            />
            {errors.email && <p className={errBase}>{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="sc-phone" className="text-sm font-medium text-black/80">
              Telefonszám <span className="text-rose-600">*</span>
            </label>
            <input
              id="sc-phone"
              type="tel"
              inputMode="tel"
              className={inputBase}
              placeholder="+36 30 132 9999"
              value={phone}
              onChange={(e) => setPhone(formatHuPhoneDisplay(e.target.value))}
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-black/45">
              Formátum: +36 30 132 9999 — a +36 törölhető, gépeléskor visszajön.
            </p>
            {errors.phone && <p className={errBase}>{errors.phone}</p>}
          </div>
          <div>
            <label
              htmlFor="sc-salary"
              className="text-sm font-medium text-black/80"
            >
              Nettó havi bérigény (Ft) <span className="text-rose-600">*</span>
            </label>
            <input
              id="sc-salary"
              inputMode="numeric"
              className={inputBase}
              placeholder="350 000"
              value={salaryNet}
              onChange={(e) => setSalaryNet(formatSalaryDisplay(e.target.value))}
            />
            <p className="mt-1 text-xs text-black/45">
              Csak szám. Ezres tagolás automatikus.
            </p>
            {errors.salaryNet && <p className={errBase}>{errors.salaryNet}</p>}
          </div>
          <ChoiceGroup
            name="startWhen"
            legend="Mikortól tudnál kezdeni?"
            options={SCREENING_START}
            value={startWhen}
            onChange={setStartWhen}
            error={errors.startWhen}
            columns={2}
          />
          <ChoiceGroup
            name="morningOk"
            legend="Vállalod a hétfő–péntek 7:30 kezdést?"
            options={SCREENING_YES_NO}
            value={morningOk}
            onChange={setMorningOk}
            error={errors.morningOk}
          />
          <ChoiceGroup
            name="fullShiftOk"
            legend="Vállalod, hogy 17:00-ig ott vagy?"
            options={SCREENING_YES_NO}
            value={fullShiftOk}
            onChange={setFullShiftOk}
            error={errors.fullShiftOk}
          />
          <ChoiceGroup
            name="saturdayOk"
            legend="Vállalod az időnkénti szombatot (8:00–12:00)?"
            options={SCREENING_YES_NO}
            value={saturdayOk}
            onChange={setSaturdayOk}
            error={errors.saturdayOk}
          />
          <ChoiceGroup
            name="commuteOk"
            legend="Megoldott a bejárás Kecskemétre (Mindszenti krt. 10.)?"
            options={SCREENING_YES_NO}
            value={commuteOk}
            onChange={setCommuteOk}
            error={errors.commuteOk}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <p className="text-sm text-black/60">
            Gyors válaszok, 1–5 skála. Nincs rossz válasz — a megfelelő
            egyeztetéshez kellenek.
          </p>
          <p className="text-xs text-black/45">1 = egyáltalán nem · 5 = nagyon</p>
          <ChoiceGroup
            name="scaleCustomer"
            legend="Mennyire szeretsz egész nap vásárlókkal beszélni?"
            options={SCALE_OPTIONS}
            value={scaleCustomer}
            onChange={setScaleCustomer}
            error={errors.scaleCustomer}
            columns={5}
          />
          <ChoiceGroup
            name="scaleEnergy"
            legend="A sok beszéd a nap végén inkább…"
            options={SCREENING_ENERGY}
            value={scaleEnergy}
            onChange={setScaleEnergy}
            error={errors.scaleEnergy}
            columns={2}
          />
          <ChoiceGroup
            name="scalePunctual"
            legend="Mennyire vagy pontos a határidőkkel és a reggeli érkezéssel?"
            options={SCALE_OPTIONS}
            value={scalePunctual}
            onChange={setScalePunctual}
            error={errors.scalePunctual}
            columns={5}
          />
          <ChoiceGroup
            name="scaleMoney"
            legend="Mennyire vagy precíz pénzzel, visszajáróval, bizonylattal?"
            options={SCALE_OPTIONS}
            value={scaleMoney}
            onChange={setScaleMoney}
            error={errors.scaleMoney}
            columns={5}
          />
          <ChoiceGroup
            name="scaleAdmin"
            legend="Mennyire szívesen számolsz / csinálsz egyszerű adminisztrációt?"
            options={SCALE_OPTIONS}
            value={scaleAdmin}
            onChange={setScaleAdmin}
            error={errors.scaleAdmin}
            columns={5}
          />
          <ChoiceGroup
            name="scaleCalm"
            legend="Mennyire maradsz nyugodt, ha sor van vagy váratlan a helyzet?"
            options={SCALE_OPTIONS}
            value={scaleCalm}
            onChange={setScaleCalm}
            error={errors.scaleCalm}
            columns={5}
          />
          <ChoiceGroup
            name="scalePatience"
            legend="Mennyire vagy türelmes nehéz / hangos vásárlóval?"
            options={SCALE_OPTIONS}
            value={scalePatience}
            onChange={setScalePatience}
            error={errors.scalePatience}
            columns={5}
          />
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4">
          <p className="text-sm text-black/60">
            Röviden, saját szavaiddal. Mezőnként legalább {SITU_MIN_CHARS}{" "}
            karakter kell a beküldéshez (max. {SITU_MAX_CHARS}).
          </p>
          <div>
            <label
              htmlFor="sc-triple"
              className="text-sm font-medium text-black/80"
            >
              Három vásárló vár egyszerre. Mit csinálsz?{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="sc-triple"
              className={textareaBase}
              maxLength={SITU_MAX_CHARS}
              value={situTriple}
              onChange={(e) => setSituTriple(e.target.value)}
            />
            <CharHint value={situTriple} />
            {errors.situTriple && (
              <p className={errBase}>{errors.situTriple}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="sc-angry"
              className="text-sm font-medium text-black/80"
            >
              Egy vásárló hangos és elégedetlen. Mit mondasz először?{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="sc-angry"
              className={textareaBase}
              maxLength={SITU_MAX_CHARS}
              value={situAngry}
              onChange={(e) => setSituAngry(e.target.value)}
            />
            <CharHint value={situAngry} />
            {errors.situAngry && <p className={errBase}>{errors.situAngry}</p>}
          </div>
          <div>
            <label
              htmlFor="sc-cash"
              className="text-sm font-medium text-black/80"
            >
              Eltérés van a kasszánál / visszajárónál. Mit teszel?{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="sc-cash"
              className={textareaBase}
              maxLength={SITU_MAX_CHARS}
              value={situCash}
              onChange={(e) => setSituCash(e.target.value)}
            />
            <CharHint value={situCash} />
            {errors.situCash && <p className={errBase}>{errors.situCash}</p>}
          </div>
          <div>
            <label
              htmlFor="sc-late"
              className="text-sm font-medium text-black/80"
            >
              Reggel 7:25, dugóban vagy. Mit csinálsz?{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="sc-late"
              className={textareaBase}
              maxLength={SITU_MAX_CHARS}
              value={situLate}
              onChange={(e) => setSituLate(e.target.value)}
            />
            <CharHint value={situLate} />
            {errors.situLate && <p className={errBase}>{errors.situLate}</p>}
          </div>
          <div>
            <label
              htmlFor="sc-like"
              className="text-sm font-medium text-black/80"
            >
              Mit bírsz legjobban egy bolti munkában, és mit a legkevésbé?{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="sc-like"
              className={textareaBase}
              maxLength={SITU_MAX_CHARS}
              value={situLikeDislike}
              onChange={(e) => setSituLikeDislike(e.target.value)}
            />
            <CharHint value={situLikeDislike} />
            {errors.situLikeDislike && (
              <p className={errBase}>{errors.situLikeDislike}</p>
            )}
          </div>
          <ChoiceGroup
            name="experience"
            legend="Volt-e bolti / ügyfélszolgálati tapasztalatod?"
            options={SCREENING_EXPERIENCE}
            value={experience}
            onChange={setExperience}
            error={errors.experience}
            columns={1}
          />
          <label className="flex items-start gap-3 text-sm text-black/75">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-black/25"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Elolvastam az{" "}
              <a
                href="/adatkezelesi-tajekoztato"
                className="font-semibold text-[var(--color-brand)] underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                adatkezelési tájékoztatót
              </a>
              , és hozzájárulok, hogy a válaszokat a jelentkezésem elbírálásához
              használjátok. <span className="text-rose-600">*</span>
            </span>
          </label>
          {errors.consent && <p className={errBase}>{errors.consent}</p>}
        </div>
      )}

      {status.kind === "error" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {status.message}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        {step > 1 && (
          <button type="button" className={btnSecondary} onClick={goBack}>
            Vissza
          </button>
        )}
        {step < 3 ? (
          <button type="submit" className={btnPrimary}>
            Tovább
          </button>
        ) : (
          <button
            type="submit"
            className={btnPrimary}
            disabled={status.kind === "submitting"}
          >
            {status.kind === "submitting" ? "Küldés…" : "Beküldöm"}
          </button>
        )}
      </div>
    </form>
  )
}
