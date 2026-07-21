'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'

/**
 * Jelenlétkezelő — Interactive ROI Calculator
 *
 * Psychology / manipulation intent (ethical: based on honest math):
 *   - Defaults are pre-seeded with a plausibly "average" 15-employee scenario
 *     so the CEO IMMEDIATELY sees a painful HUF number (>2M Ft/év) before
 *     he even touches anything.
 *   - Presets (10 / 15 / 30 fő) give 3-second engagement without thinking.
 *   - Sliders let him "tune to his reality" — the moment he moves them,
 *     the number becomes HIS number, not OURS. This is the emotional hook.
 *   - The "Ennyit VESZÍTESZ évente" red number is 2–3× larger than anything
 *     else on the card. It's the thing he takes away.
 *   - The "Egy hónap alatt visszahozza az árát" framing makes buying feel
 *     safe (not an expense — a loss-recovery operation).
 *
 * Math (deliberately conservative / defensible):
 *   monthlyHoursLost = employees × dailySlipMin / 60 × workingDays
 *   monthlyCost      = monthlyHoursLost × hourlyRate
 *   yearlyCost       = monthlyCost × 12
 *
 * All inputs have sensible clamps; all numbers are formatted hu-HU.
 */

const PRESETS = [
  { id: 'small', label: '10 fős csapat', employees: 10, dailySlipMin: 12, hourlyRate: 2200, workingDays: 22 },
  { id: 'mid', label: '15 fős csapat', employees: 15, dailySlipMin: 15, hourlyRate: 2500, workingDays: 22 },
  { id: 'large', label: '30 fős csapat', employees: 30, dailySlipMin: 18, hourlyRate: 2800, workingDays: 22 },
] as const

type PresetId = (typeof PRESETS)[number]['id']

const MAX = {
  employees: 100,
  dailySlipMin: 45,
  hourlyRate: 6000,
  workingDays: 30,
} as const

const MIN = {
  employees: 1,
  dailySlipMin: 0,
  hourlyRate: 800,
  workingDays: 15,
} as const

function formatHuf(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 Ft'
  
return `${Math.round(n).toLocaleString('hu-HU')} Ft`
}

function formatHours(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 óra'
  if (n < 10) return `${n.toFixed(1)} óra`
  
return `${Math.round(n).toLocaleString('hu-HU')} óra`
}

type SliderProps = {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  description?: string
}

function RangeSlider({ label, suffix, value, min, max, step = 1, onChange, description }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  
return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[13px] font-semibold" style={{ color: '#3F3F46' }}>{label}</label>
        <span className="text-lg font-extrabold tabular-nums" style={{ color: '#18181B' }}>
          {value.toLocaleString('hu-HU')}
          <span className="text-xs font-semibold ml-1" style={{ color: '#71717A' }}>{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="lvj-roi-slider w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2563EB 0%, #3B82F6 ${pct}%, #E4E4E7 ${pct}%, #E4E4E7 100%)`,
        }}
        aria-label={label}
      />
      {description ? <p className="mt-2 text-[11px]" style={{ color: '#71717A' }}>{description}</p> : null}
    </div>
  )
}

export default function RoiCalculator() {
  // Preload with the "mid" preset so the CEO sees >2M Ft on first paint.
  const [employees, setEmployees] = useState<number>(PRESETS[1].employees)
  const [dailySlipMin, setDailySlipMin] = useState<number>(PRESETS[1].dailySlipMin)
  const [hourlyRate, setHourlyRate] = useState<number>(PRESETS[1].hourlyRate)
  const [workingDays, setWorkingDays] = useState<number>(PRESETS[1].workingDays)
  const [activePreset, setActivePreset] = useState<PresetId | null>('mid')

  const applyPreset = (id: PresetId) => {
    const p = PRESETS.find(x => x.id === id)

    if (!p) return
    setEmployees(p.employees)
    setDailySlipMin(p.dailySlipMin)
    setHourlyRate(p.hourlyRate)
    setWorkingDays(p.workingDays)
    setActivePreset(id)
  }

  const clearPreset = () => setActivePreset(null)

  const { monthlyHours, monthlyCost, yearlyCost, fiveYearCost } = useMemo(() => {
    const mh = (employees * dailySlipMin * workingDays) / 60
    const mc = mh * hourlyRate

    
return {
      monthlyHours: mh,
      monthlyCost: mc,
      yearlyCost: mc * 12,
      fiveYearCost: mc * 12 * 5,
    }
  }, [employees, dailySlipMin, hourlyRate, workingDays])

  return (
    <section id="roi" className="relative py-12 sm:py-16 scroll-mt-20" style={{ background: '#F9F8F4' }}>
      {/* Subtle pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(24,24,27,0.06) 1px, transparent 0)',
          backgroundSize: '32px 32px',
          opacity: 0.55,
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10">
        {/* Heading */}
        <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-red-700">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v5h2v-5z" />
            </svg>
            Valós számok · Valós veszteség
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1]" style={{ color: '#18181B' }}>
            Számold ki, <span className="text-red-600">mennyit veszítesz évente</span> a láthatatlan csúszáson.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: '#52525B' }}>
            Add meg a saját céged számait (<strong style={{ color: '#18181B' }}>hány fő, mennyi a napi csúszás, milyen az óradíj</strong>), és lásd, mennyit fizetsz ma láthatatlanul.
          </p>
        </div>

        {/* Calculator card */}
        <div
          className="rounded-3xl bg-white overflow-hidden"
          style={{
            border: '1px solid #E4E4E7',
            boxShadow: '0 30px 70px rgba(24,24,27,0.08), 0 4px 12px rgba(24,24,27,0.04)',
          }}
        >
          {/* Preset tabs */}
          <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-3 border-b" style={{ borderColor: '#E4E4E7', background: '#FAFAF9' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#71717A' }}>
              Gyors kezdés
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => {
                const active = activePreset === p.id


                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={[
                      'px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors',
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-[#3F3F46] border-[#E4E4E7] hover:border-blue-300 hover:text-blue-700',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                )
              })}
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px]" style={{ color: '#71717A' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                vagy állítsd be saját kezűleg →
              </span>
            </div>
          </div>

          {/* Split — sliders left, results right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
            {/* Sliders column */}
            <div className="p-5 sm:p-8 space-y-6 bg-white">
              <RangeSlider
                label="Dolgozók száma"
                suffix="fő"
                value={employees}
                min={MIN.employees}
                max={MAX.employees}
                onChange={v => {
                  setEmployees(v)
                  clearPreset()
                }}
                description="Hány embert foglalkoztatsz összesen."
              />
              <RangeSlider
                label="Átlagos napi csúszás dolgozónként"
                suffix="perc"
                value={dailySlipMin}
                min={MIN.dailySlipMin}
                max={MAX.dailySlipMin}
                onChange={v => {
                  setDailySlipMin(v)
                  clearPreset()
                }}
                description="Késés reggel, korai távozás, hosszabb szünet, mindez összesen."
              />
              <RangeSlider
                label="Átlagos bruttó óradíj"
                suffix="Ft / óra"
                value={hourlyRate}
                min={MIN.hourlyRate}
                max={MAX.hourlyRate}
                step={50}
                onChange={v => {
                  setHourlyRate(v)
                  clearPreset()
                }}
                description="Becsült átlag: bér és járulék / munkaóra."
              />
              <RangeSlider
                label="Munkanapok havonta"
                suffix="nap"
                value={workingDays}
                min={MIN.workingDays}
                max={MAX.workingDays}
                onChange={v => {
                  setWorkingDays(v)
                  clearPreset()
                }}
                description="Magyar átlag 22. Állítsd be, ha nálad más."
              />
            </div>

            {/* Results column */}
            <div
              className="p-5 sm:p-8 flex flex-col justify-center gap-5"
              style={{
                background: 'linear-gradient(160deg, #0F1114 0%, #0B0D11 55%, #111722 100%)',
              }}
            >
              {/* Lost hours chip */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-400/40 bg-blue-400/10 text-blue-200 text-[11px] font-semibold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Elveszett idő: {formatHours(monthlyHours)} / hó
                </span>
              </div>

              {/* Monthly — smaller */}
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                  Ennyit veszítesz havonta
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-200 tabular-nums">
                  {formatHuf(monthlyCost)}
                </p>
              </div>

              {/* Yearly — the hero number */}
              <div
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(249,115,22,0.12) 100%)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  boxShadow: 'inset 0 0 40px rgba(239,68,68,0.08)',
                }}
              >
                <p className="text-[11px] uppercase tracking-widest text-red-300/90 font-bold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v5h2v-5z" />
                  </svg>
                  Ennyit veszítesz évente
                </p>
                <p
                  className="mt-1.5 text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight tabular-nums leading-none"
                  style={{
                    color: '#fecaca',
                    textShadow: '0 0 40px rgba(239,68,68,0.45), 0 0 80px rgba(239,68,68,0.15)',
                  }}
                >
                  {formatHuf(yearlyCost)}
                </p>
                <p className="mt-2 text-[12px] text-red-100/70">
                  Láthatatlanul, minden évben, minden hónapban.
                </p>
              </div>

              {/* 5 year cost — the horror multiplier */}
              <div className="flex items-center justify-between border-t border-slate-700 pt-4">
                <span className="text-[12px] text-slate-400">5 év alatt</span>
                <span className="text-lg font-bold text-red-200 tabular-nums">{formatHuf(fiveYearCost)}</span>
              </div>

              {/* Closing line + CTA */}
              <div className="mt-1 rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-4 py-3">
                <p className="text-[13px] text-emerald-100 leading-snug">
                  <strong className="text-emerald-200 font-bold">A Jelenlétkezelő</strong> az első hónapokban megtérül. Onnan minden megtakarított forint tiszta nyereség.
                </p>
              </div>

              <Link
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                style={{ boxShadow: '0 0 28px rgba(37,99,235,0.5)' }}
              >
                Állítsuk le a veszteséget, foglalj demót
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Footer disclaimer */}
          <div className="px-5 sm:px-8 py-3 border-t" style={{ background: '#FAFAF9', borderColor: '#E4E4E7' }}>
            <p className="text-[11px]" style={{ color: '#71717A' }}>
              A számítás becslés: <code className="font-mono bg-white px-1 py-0.5 rounded border" style={{ borderColor: '#E4E4E7' }}>fő × napi perc × munkanap / 60 × óradíj</code>. Konzervatív, a valóság általában magasabb.
            </p>
          </div>
        </div>

        {/* Styling for the native range slider — scoped via CSS */}
        <style>{`
          .lvj-roi-slider {
            -webkit-appearance: none;
            appearance: none;
            height: 6px;
            border-radius: 999px;
            outline: none;
          }
          .lvj-roi-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
            border: 2.5px solid #2563EB;
            box-shadow: 0 2px 8px rgba(37,99,235,0.35);
            cursor: pointer;
            transition: transform 0.12s ease;
          }
          .lvj-roi-slider::-webkit-slider-thumb:hover {
            transform: scale(1.12);
          }
          .lvj-roi-slider::-moz-range-thumb {
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
            border: 2.5px solid #2563EB;
            box-shadow: 0 2px 8px rgba(37,99,235,0.35);
            cursor: pointer;
            transition: transform 0.12s ease;
          }
          .lvj-roi-slider::-moz-range-thumb:hover {
            transform: scale(1.12);
          }
          .lvj-roi-slider:focus::-webkit-slider-thumb {
            box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
          }
          .lvj-roi-slider:focus::-moz-range-thumb {
            box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
          }
        `}</style>
      </div>
    </section>
  )
}
