'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'

/**
 * Bolti analitika — Interactive ROI Calculator
 *
 * Frame: UPSIDE (green) instead of loss, because traffic data is a
 * growth investment, not a leak-plug. This also differentiates the page
 * visually from the Jelenlétkezelő one (which uses red loss framing).
 *
 * Inputs:
 *   - Monthly visitors (the thing the CEO discovers when they install the Vendégszámláló)
 *   - Avg basket value (they already know this from POS)
 *   - Current conversion rate % (they can guess; slider starts at 18%)
 *
 * Output (yearly figures):
 *   - Current revenue (context, small)
 *   - +1% conversion → Ft/year extra (small)
 *   - +2% conversion → Ft/year extra (BIG green hero number)
 *   - +3% conversion → Ft/year extra (medium)
 *
 * Math:
 *   uplift_Npct_yearly = monthlyVisitors × (N / 100) × avgBasket × 12
 *
 * Note on "+1-3%" defensibility: in retail, installing a counter typically
 * yields +1-3% conversion lift via smarter staffing, promotion timing,
 * and layout changes targeted at real (not guessed) peak hours.
 */

const PRESETS = [
  { id: 'small', label: 'Kisbolt', monthlyVisitors: 2000, avgBasket: 6500, currentConv: 22 },
  { id: 'mid', label: 'Közepes bolt', monthlyVisitors: 4000, avgBasket: 8500, currentConv: 18 },
  { id: 'large', label: 'Nagy bolt / plaza', monthlyVisitors: 10000, avgBasket: 12000, currentConv: 12 },
] as const

type PresetId = (typeof PRESETS)[number]['id']

const MAX = {
  monthlyVisitors: 25000,
  avgBasket: 40000,
  currentConv: 50,
} as const

const MIN = {
  monthlyVisitors: 300,
  avgBasket: 1000,
  currentConv: 3,
} as const

function formatHuf(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 Ft'

  return `${Math.round(n).toLocaleString('hu-HU')} Ft`
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
        className="lba-roi-slider w-full cursor-pointer"
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
  const [monthlyVisitors, setMonthlyVisitors] = useState<number>(PRESETS[1].monthlyVisitors)
  const [avgBasket, setAvgBasket] = useState<number>(PRESETS[1].avgBasket)
  const [currentConv, setCurrentConv] = useState<number>(PRESETS[1].currentConv)
  const [activePreset, setActivePreset] = useState<PresetId | null>('mid')

  const applyPreset = (id: PresetId) => {
    const p = PRESETS.find(x => x.id === id)

    if (!p) return
    setMonthlyVisitors(p.monthlyVisitors)
    setAvgBasket(p.avgBasket)
    setCurrentConv(p.currentConv)
    setActivePreset(id)
  }

  const clearPreset = () => setActivePreset(null)

  const { currentYearly, uplift1, uplift2, uplift3 } = useMemo(() => {
    const monthlyRevenue = monthlyVisitors * (currentConv / 100) * avgBasket
    const stepYearly = monthlyVisitors * 0.01 * avgBasket * 12

    return {
      currentYearly: monthlyRevenue * 12,
      uplift1: stepYearly,
      uplift2: stepYearly * 2,
      uplift3: stepYearly * 3,
    }
  }, [monthlyVisitors, avgBasket, currentConv])

  return (
    <section id="roi" className="relative py-12 sm:py-16 scroll-mt-20" style={{ background: '#F9F8F4' }}>
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
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8-9 9-4-4-6 6" />
            </svg>
            Valós számok · Valós növekedés
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1]" style={{ color: '#18181B' }}>
            Mennyit hoz évente, ha <span className="text-emerald-600">+2%-kal több látogató</span> vásárol?
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: '#52525B' }}>
            Add meg a saját boltod számait (<strong style={{ color: '#18181B' }}>havi látogató, átlagos kosárérték, jelenlegi konverzió</strong>), és látni fogod, mennyit termel évente ugyanez a forgalom, ha a mért adatokra építesz: okosabb műszak, jobban időzített kampány, a csúcsra méretezett eladótér.
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

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
            {/* Sliders column */}
            <div className="p-5 sm:p-8 space-y-6 bg-white">
              <RangeSlider
                label="Havi látogatók száma"
                suffix="fő"
                value={monthlyVisitors}
                min={MIN.monthlyVisitors}
                max={MAX.monthlyVisitors}
                step={100}
                onChange={v => {
                  setMonthlyVisitors(v)
                  clearPreset()
                }}
                description="Hányan lépnek be a boltodba egy hónap alatt. Ha nem tudod pontosan, becsüld meg — a Vendégszámláló telepítése után az első hónapban már forintra pontosan látod."
              />
              <RangeSlider
                label="Átlagos kosárérték"
                suffix="Ft"
                value={avgBasket}
                min={MIN.avgBasket}
                max={MAX.avgBasket}
                step={100}
                onChange={v => {
                  setAvgBasket(v)
                  clearPreset()
                }}
                description="Egy átlagos vásárlás értéke. A kasszarendszeredből vagy a számlatömbödből kiszámítható: havi bevétel osztva a tranzakciók számával."
              />
              <RangeSlider
                label="Jelenlegi konverziós ráta"
                suffix="%"
                value={currentConv}
                min={MIN.currentConv}
                max={MAX.currentConv}
                onChange={v => {
                  setCurrentConv(v)
                  clearPreset()
                }}
                description="A bejövők hány százaléka vásárol. Magyar kiskereskedelemben jellemzően 10–25% között van. Ha nem tudod pontosan, az első hónap után mi is megmutatjuk a saját számaidon."
              />
            </div>

            {/* Results column */}
            <div
              className="p-5 sm:p-8 flex flex-col justify-center gap-4"
              style={{
                background: 'linear-gradient(160deg, #0F1114 0%, #0B0D11 55%, #111722 100%)',
              }}
            >
              {/* Current revenue context */}
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                  Jelenlegi éves bevétel (becslés)
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-200 tabular-nums">
                  {formatHuf(currentYearly)}
                </p>
              </div>

              {/* +1% row */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 border border-emerald-400/20 bg-emerald-500/5">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-emerald-300/80 font-bold">+1% konverzió</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">éves többletbevétel</p>
                </div>
                <p className="text-xl font-extrabold text-emerald-300 tabular-nums">+{formatHuf(uplift1)}</p>
              </div>

              {/* +2% — the hero number */}
              <div
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(52,211,153,0.12) 100%)',
                  border: '1px solid rgba(52,211,153,0.4)',
                  boxShadow: 'inset 0 0 40px rgba(16,185,129,0.08)',
                }}
              >
                <p className="text-[11px] uppercase tracking-widest text-emerald-300/95 font-bold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z" />
                  </svg>
                  +2% konverzió · éves többletbevétel
                </p>
                <p
                  className="mt-1.5 text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight tabular-nums leading-none"
                  style={{
                    color: '#A7F3D0',
                    textShadow: '0 0 40px rgba(52,211,153,0.45), 0 0 80px rgba(16,185,129,0.18)',
                  }}
                >
                  +{formatHuf(uplift2)}
                </p>
                <p className="mt-2 text-[12px] text-emerald-100/80">
                  Ennyivel hoz többet évente ugyanez a forgalom, ha százból kettővel több vásárló dönt a vásárlás mellett.
                </p>
              </div>

              {/* +3% row */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 border border-emerald-400/20 bg-emerald-500/5">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-emerald-300/80 font-bold">+3% konverzió</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">éves többletbevétel</p>
                </div>
                <p className="text-xl font-extrabold text-emerald-300 tabular-nums">+{formatHuf(uplift3)}</p>
              </div>

              {/* Closing line + CTA */}
              <div className="mt-1 rounded-xl bg-blue-500/10 border border-blue-400/30 px-4 py-3">
                <p className="text-[13px] text-blue-100 leading-snug">
                  A mért forgalom önmagában is segít: <strong className="text-blue-200 font-bold">okosabb műszakbeosztás, jobban időzített kampány, a csúcsra méretezett eladótér</strong>. A +1–3% konverziónövekedés reális cél a kiskereskedelemben.
                </p>
              </div>

              <Link
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                style={{ boxShadow: '0 0 28px rgba(37,99,235,0.5)' }}
              >
                Nézzük meg a saját adataidon — foglalj bemutatót
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Footer disclaimer */}
          <div className="px-5 sm:px-8 py-3 border-t" style={{ background: '#FAFAF9', borderColor: '#E4E4E7' }}>
            <p className="text-[11px]" style={{ color: '#71717A' }}>
              A számítás becslés: <code className="font-mono bg-white px-1 py-0.5 rounded border" style={{ borderColor: '#E4E4E7' }}>havi látogató × 0,01 × átlagos kosárérték × 12</code> = +1% konverzió éves többletbevétele. A tényleges konverziót forintra pontosan akkor látod, ha a Vendégszámlálót Turinova POS-szal együtt használod.
            </p>
          </div>
        </div>

        {/* Scoped slider styling */}
        <style>{`
          .lba-roi-slider {
            -webkit-appearance: none;
            appearance: none;
            height: 6px;
            border-radius: 999px;
            outline: none;
          }
          .lba-roi-slider::-webkit-slider-thumb {
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
          .lba-roi-slider::-webkit-slider-thumb:hover {
            transform: scale(1.12);
          }
          .lba-roi-slider::-moz-range-thumb {
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
            border: 2.5px solid #2563EB;
            box-shadow: 0 2px 8px rgba(37,99,235,0.35);
            cursor: pointer;
            transition: transform 0.12s ease;
          }
          .lba-roi-slider::-moz-range-thumb:hover {
            transform: scale(1.12);
          }
          .lba-roi-slider:focus::-webkit-slider-thumb {
            box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
          }
          .lba-roi-slider:focus::-moz-range-thumb {
            box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
          }
        `}</style>
      </div>
    </section>
  )
}
