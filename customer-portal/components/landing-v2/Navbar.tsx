'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { LANDING_V2_NAV, LANDING_V2_DEMO } from '@/components/landing-v2/landing-v2-nav'

const navLinkClass =
  'px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150'

type Accent = {
  bar: string
  iconBg: string
  iconText: string
  hoverBorder: string
  cardHoverShadow: string
  chipBg: string
  chipText: string
  chipBorder: string
  ringOnHover: string
  headerTint: string
  metricText: string
  metricBg: string
  metricBorder: string
}

const ACCENTS: Record<string, Accent> = {
  orange: {
    bar: 'bg-orange-500',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
    hoverBorder: 'group-hover:border-orange-300',
    cardHoverShadow: 'group-hover:shadow-orange-200/50',
    chipBg: 'bg-orange-50',
    chipText: 'text-orange-700',
    chipBorder: 'border-orange-200',
    ringOnHover: 'group-hover:ring-orange-200',
    headerTint: 'bg-gradient-to-b from-orange-50/70 to-white',
    metricText: 'text-orange-700',
    metricBg: 'bg-orange-50',
    metricBorder: 'border-orange-200',
  },
  indigo: {
    bar: 'bg-indigo-500',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-700',
    hoverBorder: 'group-hover:border-indigo-300',
    cardHoverShadow: 'group-hover:shadow-indigo-200/50',
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-700',
    chipBorder: 'border-indigo-200',
    ringOnHover: 'group-hover:ring-indigo-200',
    headerTint: 'bg-gradient-to-b from-indigo-50/70 to-white',
    metricText: 'text-indigo-700',
    metricBg: 'bg-indigo-50',
    metricBorder: 'border-indigo-200',
  },
  emerald: {
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    hoverBorder: 'group-hover:border-emerald-300',
    cardHoverShadow: 'group-hover:shadow-emerald-200/50',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    chipBorder: 'border-emerald-200',
    ringOnHover: 'group-hover:ring-emerald-200',
    headerTint: 'bg-gradient-to-b from-emerald-50/70 to-white',
    metricText: 'text-emerald-700',
    metricBg: 'bg-emerald-50',
    metricBorder: 'border-emerald-200',
  },
  sky: {
    bar: 'bg-sky-500',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-700',
    hoverBorder: 'group-hover:border-sky-300',
    cardHoverShadow: 'group-hover:shadow-sky-200/50',
    chipBg: 'bg-sky-50',
    chipText: 'text-sky-700',
    chipBorder: 'border-sky-200',
    ringOnHover: 'group-hover:ring-sky-200',
    headerTint: 'bg-gradient-to-b from-sky-50/70 to-white',
    metricText: 'text-sky-700',
    metricBg: 'bg-sky-50',
    metricBorder: 'border-sky-200',
  },
  violet: {
    bar: 'bg-violet-500',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
    hoverBorder: 'group-hover:border-violet-300',
    cardHoverShadow: 'group-hover:shadow-violet-200/50',
    chipBg: 'bg-violet-50',
    chipText: 'text-violet-700',
    chipBorder: 'border-violet-200',
    ringOnHover: 'group-hover:ring-violet-200',
    headerTint: 'bg-gradient-to-b from-violet-50/70 to-white',
    metricText: 'text-violet-700',
    metricBg: 'bg-violet-50',
    metricBorder: 'border-violet-200',
  },
}

type SolutionId = 'webshop' | 'asztalos' | 'footcounter' | 'attendance' | 'custom'

type Solution = {
  id: SolutionId
  label: string
  href: string
  audience: string
  outcome: string
  metric: string
  metricLabel: string
  accent: Accent
  Icon: React.FC<{ className?: string }>
}

const IconCart: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-1.5 4.5a1 1 0 0 0 .9 1.3H19" />
    <circle cx="9" cy="21" r="1.5" />
    <circle cx="18" cy="21" r="1.5" />
  </svg>
)

const IconSaw: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7h12l-1.5 2L15 11l-1.5 2L15 15H3z" />
    <path d="M15 11l5-2 1 3-4 2" />
    <path d="M17 17l2 3" />
  </svg>
)

const IconFootfall: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h16" />
    <path d="M6 20V10m4 10V6m4 14v-8m4 8V8" />
  </svg>
)

const IconClock: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const IconWand: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 4v2M19 8h2M17 6l-11 11a2 2 0 1 0 2.8 2.8l11-11" />
    <path d="M14 9l1 1" />
  </svg>
)

const solutions: Solution[] = [
  {
    id: 'webshop',
    label: 'Webshop ERP',
    href: '/v2',
    audience: 'Webshop tulajdonosoknak',
    outcome: 'Rendelés, készlet, számla egy helyen.',
    metric: '−40%',
    metricLabel: 'kezelési idő',
    accent: ACCENTS.orange,
    Icon: IconCart,
  },
  {
    id: 'asztalos',
    label: 'Asztalos ERP',
    href: '/asztalos-erp',
    audience: 'Asztalos cégeknek',
    outcome: 'Optimalizált árajánlat és szabásterv automatikusan.',
    metric: '5 perc',
    metricLabel: '30 perc helyett',
    accent: ACCENTS.indigo,
    Icon: IconSaw,
  },
  {
    id: 'footcounter',
    label: 'Bolti analitika',
    href: '/vasarloszamlalo',
    audience: 'Üzlet- és lánctulajdonosoknak',
    outcome: 'Lásd a forgalmad, növeld a konverziót.',
    metric: '+12%',
    metricLabel: 'átlagos konverzió',
    accent: ACCENTS.emerald,
    Icon: IconFootfall,
  },
  {
    id: 'attendance',
    label: 'Jelenlétkezelő',
    href: '/munkaido-nyilvantartas',
    audience: 'HR-nek és vezetőknek',
    outcome: 'Jelenlét és órák, viták nélkül.',
    metric: '−6 óra',
    metricLabel: 'adminisztráció / hét',
    accent: ACCENTS.sky,
    Icon: IconClock,
  },
  {
    id: 'custom',
    label: 'Egyedi fejlesztés',
    href: '/egyedi-fejlesztes',
    audience: 'Saját folyamatokhoz',
    outcome: 'Bármilyen ötletből működő rendszer.',
    metric: '2–6 hét',
    metricLabel: 'átlagos bevezetés',
    accent: ACCENTS.violet,
    Icon: IconWand,
  },
]

function WebshopErpMiniMock() {
  const rows = [
    { order: 'R-2026-1042', customer: 'Kovács Péter', pill: 'Csomagolható', tone: 'good' as const },
    { order: 'R-2026-1043', customer: 'Nagy Eszter', pill: 'Hiány', tone: 'bad' as const },
    { order: 'R-2026-1044', customer: 'Tóth Gábor', pill: 'Beszerzés', tone: 'info' as const },
  ]

  const pillClass = (tone: (typeof rows)[number]['tone']) => {
    if (tone === 'good') return 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
    if (tone === 'bad') return 'bg-[#ffebee] text-[#b71c1c] border-[#ef9a9a]'
    return 'bg-[#e3f2fd] text-[#1565c0] border-[#90caf9]'
  }

  return (
    <div>
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-600">Beérkező rendelések</span>
          <span className="text-[10px] text-slate-400">Ma</span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(r => (
            <div key={r.order} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-800 truncate">{r.order}</p>
                <p className="text-[10px] text-slate-500 truncate">{r.customer}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${pillClass(r.tone)}`}>
                {r.pill}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AsztalosErpMiniMock() {
  // Panel placements (% of board) — matches the real /opti output pattern.
  // Colors sourced from main-app's getPanelColor (size-class palette):
  //   grey  #f1f3f4  (very large)
  //   blue  #e8f0fe  (large)
  //   green #e6f4ea  (medium)
  //   yellow#fef7e0  (small-medium)
  //   pink  #fce7f3  (small)
  const panels: Array<{ l: number; t: number; w: number; h: number; color: string }> = [
    { l: 0,  t: 0,  w: 46, h: 52, color: '#f1f3f4' },
    { l: 46, t: 0,  w: 30, h: 52, color: '#e8f0fe' },
    { l: 76, t: 0,  w: 20, h: 52, color: '#fef7e0' },
    { l: 0,  t: 52, w: 32, h: 48, color: '#e6f4ea' },
    { l: 32, t: 52, w: 28, h: 48, color: '#e6f4ea' },
    { l: 60, t: 52, w: 20, h: 48, color: '#fce7f3' },
    { l: 80, t: 52, w: 16, h: 48, color: '#fef7e0' },
  ]

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-700">Szabásterv</span>
          <span className="text-[9px] text-slate-500">7 / 7 panel</span>
        </div>

        {/* Board with placed panels */}
        <div
          className="mt-1.5 relative rounded-md overflow-hidden border border-slate-300 bg-slate-100"
          style={{ height: '92px' }}
          aria-hidden
        >
          {panels.map((p, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${p.l}%`,
                top: `${p.t}%`,
                width: `${p.w}%`,
                height: `${p.h}%`,
                backgroundColor: p.color,
                border: '1px solid rgba(51, 65, 85, 0.5)',
              }}
            />
          ))}

          {/* Waste sliver on the right (hatched) */}
          <div
            className="absolute"
            style={{
              left: '96%',
              top: 0,
              width: '4%',
              height: '100%',
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(15,23,42,0.18) 0 2px, rgba(15,23,42,0) 2px 5px)',
              backgroundColor: 'rgba(226, 232, 240, 0.6)',
              borderLeft: '1px dashed rgba(51, 65, 85, 0.4)',
            }}
          />
        </div>
      </div>

      {/* KPI strip: utilization (second metric hiding in the mockup) */}
      <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] text-slate-600">Kihasználtság</span>
        </div>
        <span className="text-[10px] font-bold text-indigo-700">92%</span>
      </div>
    </div>
  )
}

function FootcounterMiniMock() {
  // Weekday × hour heatmap — matches the real /footcounter-live output pattern.
  // Rows: Mon..Sun (H K Sz Cs P Szo V). Cols: 8..15 (typical retail hours).
  // Values 0..1, driven to look believable: slow morning, peaks around
  // 10-12 and 14-16, Sat heaviest midday, Sunday mostly closed.
  const ROWS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V'] as const
  const COLS = ['8', '9', '10', '11', '12', '13', '14', '15'] as const

  // 7 x 8 matrix of intensity 0..1
  const matrix: number[][] = [
    /* H  */ [0.08, 0.25, 0.55, 0.72, 0.85, 0.45, 0.65, 0.55],
    /* K  */ [0.05, 0.30, 0.60, 0.85, 0.70, 0.50, 0.80, 0.45],
    /* Sz */ [0.10, 0.20, 0.45, 0.65, 0.60, 0.55, 0.50, 0.30],
    /* Cs */ [0.08, 0.35, 0.65, 0.90, 0.75, 0.80, 0.55, 0.30],
    /* P  */ [0.10, 0.30, 0.60, 0.70, 0.75, 0.95, 0.90, 0.55],
    /* Szo*/ [0.05, 0.55, 0.85, 1.00, 0.95, 0.75, 0.50, 0.20],
    /* V  */ [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  ]

  const cellColor = (v: number) => {
    if (v <= 0.02) return '#ECEFF1' // matches real heatmap "0" color
    // Scale emerald/teal opacity. #00897B at alpha.
    const alpha = 0.18 + v * 0.75
    return `rgba(0, 137, 123, ${alpha.toFixed(2)})`
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
            <span className="relative inline-flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 lv2-live-pulse" />
              <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
          <span className="text-[9px] text-slate-500">Forgalom · 7 nap</span>
        </div>

        {/* Heatmap */}
        <div className="mt-1.5 flex gap-1">
          {/* Row labels column */}
          <div className="flex flex-col justify-between py-[1px]">
            {ROWS.map(r => (
              <span
                key={r}
                className="text-[8px] leading-none text-slate-400 font-semibold"
                style={{ height: '8px' }}
              >
                {r}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1">
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${COLS.length}, minmax(0, 1fr))` }}
            >
              {matrix.flatMap((row, rIdx) =>
                row.map((v, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="rounded-[2px]"
                    style={{
                      height: '8px',
                      backgroundColor: cellColor(v),
                    }}
                  />
                ))
              )}
            </div>

            {/* Hour axis */}
            <div
              className="mt-1 grid text-[7px] leading-none text-slate-400 font-medium"
              style={{ gridTemplateColumns: `repeat(${COLS.length}, minmax(0, 1fr))` }}
            >
              {COLS.map(h => (
                <span key={h} className="text-center">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip — two proof points, matches real dashboard chip style */}
      <div className="flex gap-1.5">
        <div className="flex-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-1 flex items-center justify-between">
          <span className="text-[9px] text-emerald-700 font-medium">Most bent</span>
          <span className="text-[10px] font-bold text-emerald-700">32</span>
        </div>
        <div className="flex-1 rounded-md bg-white border border-emerald-200 px-1.5 py-1 flex items-center justify-between">
          <span className="text-[9px] text-emerald-700 font-medium">átlag</span>
          <span className="text-[10px] font-bold text-emerald-700">+12%</span>
        </div>
      </div>
    </div>
  )
}

function AttendanceMiniMock() {
  // Palette sourced from main-app/src/components/TodayAttendanceDashboard.tsx
  // (NOTION_ATTENDANCE). We use the exact colors so the mock mirrors the real
  // "Mai jelenlét" home widget the buyer will see daily.
  const PAL = {
    in:     { bg: '#E8F5EE', border: '#B8DEC9', text: '#2F6F4F', dot: '#7CB89A', rowBg: 'rgba(124, 184, 154, 0.08)' },
    left:   { bg: '#FFF8E8', border: '#F0D08A', text: '#8B5A00', dot: '#E8B86D', rowBg: 'rgba(232, 184, 109, 0.10)' },
    holi:   { bg: '#FDECEC', border: '#EF9A9A', text: '#B71C1C', dot: '#E57373', rowBg: 'rgba(229, 115, 115, 0.08)' },
  }

  type Status = 'in' | 'left' | 'holi'
  const rows: Array<{ name: string; time: string; status: Status; badge?: string }> = [
    { name: 'Kovács Péter',  time: '08:02',    status: 'in' },
    { name: 'Nagy Eszter',   time: '08:15',    status: 'in' },
    { name: 'Tóth Gábor',    time: '→ 16:40',  status: 'left' },
    { name: 'Szabó Anna',    time: '',         status: 'holi', badge: 'SZ' },
  ]

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-700">Mai jelenlét</span>
          <span className="text-[9px] text-slate-500">14 dolgozó</span>
        </div>

        {/* Real chip row (Bent / Távozott / Szab) */}
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
            style={{ backgroundColor: PAL.in.bg, borderColor: PAL.in.border, color: PAL.in.text }}
          >
            Bent 12
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
            style={{ backgroundColor: PAL.left.bg, borderColor: PAL.left.border, color: PAL.left.text }}
          >
            Távozott 1
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
            style={{ backgroundColor: PAL.holi.bg, borderColor: PAL.holi.border, color: PAL.holi.text }}
          >
            Szab 1
          </span>
        </div>

        {/* Employee rows with status-tinted row bg */}
        <div className="mt-1.5 space-y-[3px]">
          {rows.map(r => {
            const p = PAL[r.status]
            return (
              <div
                key={r.name}
                className="flex items-center justify-between px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: p.rowBg }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.dot }}
                  />
                  <span className="text-[10px] font-medium text-slate-800 truncate">{r.name}</span>
                </div>
                {r.badge ? (
                  <span
                    className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[9px] font-bold border"
                    style={{ backgroundColor: PAL.holi.bg, borderColor: PAL.holi.border, color: PAL.holi.text }}
                  >
                    {r.badge}
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-semibold text-slate-700"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {r.time}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Second emotional hit: monthly overtime (ties daily ritual to payroll) */}
      <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">Havi túlóra</span>
        <span className="text-[10px] font-bold text-sky-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
          18 ó 30 p
        </span>
      </div>
    </div>
  )
}

function CustomMiniMock() {
  // 4-milestone project timeline — phase-generic, size-agnostic.
  // Current progress: Felmérés ✓, Terv ✓, Fejlesztés ◐, Átadás ○
  type Phase = { week: string; label: string; state: 'done' | 'active' | 'todo' }
  const phases: Phase[] = [
    { week: 'Hét 1',   label: 'Felmérés',   state: 'done' },
    { week: 'Hét 2–3', label: 'Terv',       state: 'done' },
    { week: 'Hét 4–5', label: 'Fejlesztés', state: 'active' },
    { week: 'Hét 6',   label: 'Átadás',     state: 'todo' },
  ]

  // Progress of the connecting line: how far to fill (done = before dot, active = half past)
  // done index covers up to that dot fully, active adds half the next segment
  const doneCount = phases.filter(p => p.state === 'done').length
  const hasActive = phases.some(p => p.state === 'active')
  const segCount = phases.length - 1
  // Visual fill ratio across the whole line (0..1)
  const fillRatio = Math.min(
    1,
    (doneCount - 1 + (hasActive ? 1.5 : 1)) / segCount
  )

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-700">Projekt · 6 hét</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-violet-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
            Folyamatban
          </span>
        </div>

        {/* Timeline */}
        <div className="mt-2.5 relative" style={{ paddingTop: '4px', paddingBottom: '2px' }}>
          {/* Base line */}
          <div
            className="absolute left-[10%] right-[10%] top-[7px] h-[2px] rounded-full bg-slate-200"
          />
          {/* Progress fill line (violet) */}
          <div
            className="absolute left-[10%] top-[7px] h-[2px] rounded-full bg-violet-400"
            style={{ width: `${fillRatio * 80}%` }}
          />

          {/* Milestone dots */}
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
            {phases.map((p, i) => {
              const isDone = p.state === 'done'
              const isActive = p.state === 'active'
              return (
                <div key={i} className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={[
                      'relative z-10 rounded-full flex items-center justify-center',
                      isDone ? 'bg-violet-500' : isActive ? 'bg-white border-2 border-violet-500' : 'bg-white border-2 border-slate-300',
                    ].join(' ')}
                    style={{ width: '12px', height: '12px' }}
                  >
                    {isDone && (
                      <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week labels */}
          <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
            {phases.map((p, i) => (
              <span key={i} className="text-[8px] text-slate-400 text-center leading-none">
                {p.week}
              </span>
            ))}
          </div>

          {/* Phase labels */}
          <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
            {phases.map((p, i) => (
              <span
                key={i}
                className={[
                  'text-[9px] text-center leading-tight font-semibold',
                  p.state === 'active' ? 'text-violet-700' : p.state === 'done' ? 'text-slate-700' : 'text-slate-400',
                ].join(' ')}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Trust strip: kills the CEO's #1 custom-dev fear (runaway cost / endless project) */}
      <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-700">Fix ár</span>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] font-semibold text-violet-700">Fix határidő</span>
      </div>

      {/* Reassurance line: speaks to non-technical CEOs with only an idea */}
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 flex items-center gap-1.5">
        <svg
          className="w-3 h-3 text-violet-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 18h6m-5 3h4M12 3a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-1.3A7 7 0 0012 3z"
          />
        </svg>
        <span className="text-[10px] italic text-violet-800 leading-tight">
          Te megálmodod, mi megépítjük.
        </span>
      </div>
    </div>
  )
}

const MOCKS: Record<SolutionId, React.FC> = {
  webshop: WebshopErpMiniMock,
  asztalos: AsztalosErpMiniMock,
  footcounter: FootcounterMiniMock,
  attendance: AttendanceMiniMock,
  custom: CustomMiniMock,
}

function SolutionCard({ s }: { s: Solution }) {
  const Mock = MOCKS[s.id]
  const a = s.accent
  return (
    <Link href={s.href} className="group block focus:outline-none h-full">
      <div
        className={[
          'relative h-full flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden',
          'transition-all duration-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)]',
          a.hoverBorder,
          'group-hover:-translate-y-0.5 group-hover:shadow-xl',
          a.cardHoverShadow,
        ].join(' ')}
      >
        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${a.bar}`} />

        {/* Tinted header = the main identity block */}
        <div className={`px-3.5 pt-3.5 pb-3 ${a.headerTint}`}>
          <div className={`inline-flex w-11 h-11 rounded-xl items-center justify-center ${a.iconBg}`}>
            <s.Icon className={`w-6 h-6 ${a.iconText}`} />
          </div>
          <h3 className="mt-2.5 text-[17px] font-extrabold text-slate-900 leading-tight tracking-tight">
            {s.label}
          </h3>
          <span
            className={[
              'mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
              a.chipBg,
              a.chipText,
              a.chipBorder,
            ].join(' ')}
          >
            {s.audience}
          </span>
        </div>

        {/* Mock */}
        <div className="px-3.5 pt-2 pb-3">
          <Mock />
        </div>

        {/* Metric + outcome pinned at bottom */}
        <div className="mt-auto px-3.5 pb-3.5 pt-2 border-t border-slate-100">
          <div
            className={[
              'inline-flex items-baseline gap-1.5 px-2 py-1 rounded-md border',
              a.metricBg,
              a.metricBorder,
            ].join(' ')}
          >
            <span className={`text-[15px] font-extrabold leading-none ${a.metricText}`}>
              {s.metric}
            </span>
            <span className="text-[10px] font-medium text-slate-600 leading-none">
              {s.metricLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            {s.outcome}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const openSolutions = useCallback(() => {
    clearCloseTimer()
    setSolutionsOpen(true)
  }, [clearCloseTimer])

  const closeSolutionsDelayed = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setSolutionsOpen(false), 180)
  }, [clearCloseTimer])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!solutionsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSolutionsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [solutionsOpen])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  return (
    <header
      className={[
        'sticky top-0 z-50 w-full transition-all duration-200 overflow-visible',
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200'
          : 'bg-white border-b border-slate-100',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/images/turinova-logo.png"
                alt="Turinova"
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Fő navigáció">
            <Link href={LANDING_V2_NAV[0].href} className={navLinkClass}>
              {LANDING_V2_NAV[0].label}
            </Link>

            {/* Megoldások mega menu */}
            <div className="relative" onMouseEnter={openSolutions} onMouseLeave={closeSolutionsDelayed}>
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                aria-expanded={solutionsOpen}
                aria-haspopup="true"
                onClick={() => setSolutionsOpen(o => !o)}
              >
                Megoldások
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {solutionsOpen && (
                <div
                  className="fixed inset-x-0 top-16 z-40 border-b border-slate-200 bg-white shadow-xl shadow-slate-200/40"
                  onMouseEnter={openSolutions}
                  onMouseLeave={closeSolutionsDelayed}
                >
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-end justify-between gap-6 mb-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Megoldások</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          Melyik illik a céged működéséhez?
                        </p>
                      </div>
                    </div>

                    {/* One-row, 5 cards */}
                    <div className="grid grid-cols-5 gap-4 items-stretch">
                      {solutions.map(s => (
                        <SolutionCard key={s.id} s={s} />
                      ))}
                    </div>

                    {/* Trust strip */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Magyar támogatás
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Helyi bevezetés
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          NAV-kompatibilis számlázás
                        </span>
                      </div>

                      <Link
                        href="/kapcsolat#demo"
                        onClick={() => setSolutionsOpen(false)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
                      >
                        {LANDING_V2_DEMO.label}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {LANDING_V2_NAV.slice(1).map(link => (
              <a key={link.label} href={link.href} className={navLinkClass}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href={LANDING_V2_DEMO.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
            >
              {LANDING_V2_DEMO.label}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Menü bezárása' : 'Menü megnyitása'}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white max-h-[min(85vh,calc(100dvh-4rem))] overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col gap-1">
            <Link
              href={LANDING_V2_NAV[0].href}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50"
            >
              {LANDING_V2_NAV[0].label}
            </Link>

            <button
              type="button"
              onClick={() => setMobileSolutionsOpen(v => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50"
              aria-expanded={mobileSolutionsOpen}
            >
              Megoldások
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${mobileSolutionsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {mobileSolutionsOpen && (
              <div className="pb-2 space-y-2 border-b border-slate-100 mb-2">
                {solutions.map(s => {
                  const a = s.accent
                  return (
                    <Link
                      key={s.id}
                      href={s.href}
                      onClick={() => {
                        setMobileOpen(false)
                        setMobileSolutionsOpen(false)
                      }}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${a.iconBg}`}>
                        <s.Icon className={`w-5 h-5 ${a.iconText}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold text-slate-900 leading-tight">{s.label}</p>
                            <span
                              className={[
                                'mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border',
                                a.chipBg,
                                a.chipText,
                                a.chipBorder,
                              ].join(' ')}
                            >
                              {s.audience}
                            </span>
                          </div>
                          <span
                            className={[
                              'shrink-0 inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-extrabold',
                              a.metricBg,
                              a.metricBorder,
                              a.metricText,
                            ].join(' ')}
                          >
                            {s.metric}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600 leading-snug">{s.outcome}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
            {LANDING_V2_NAV.slice(1).map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <a
                href={LANDING_V2_DEMO.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 text-center shadow-sm shadow-orange-200"
              >
                {LANDING_V2_DEMO.label} →
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
