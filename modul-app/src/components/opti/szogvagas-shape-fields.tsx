'use client'

import { useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import {
  szogShapeLabelForCorners,
  szogTrapParallelFullMm,
  type SzogCornerCut,
  type SzogShapeKind,
  type SzogTrapAxis
} from '@/lib/opti/szogvagas-preview'
import { cn } from '@/lib/utils'

type Props = {
  grainMm: number
  crossMm: number
  kind: SzogShapeKind
  trapShortMm: number
  trapAxis: SzogTrapAxis
  corners: SzogCornerCut[]
  disabled?: boolean
  error?: string
  onKindChange: (kind: SzogShapeKind) => void
  onTrapShortChange: (raw: string) => void
  onTrapAxisChange: (axis: SzogTrapAxis) => void
  onEnter?: () => void
}

function AxisPicker({
  value,
  disabled,
  onChange
}: {
  value: SzogTrapAxis
  disabled?: boolean
  onChange: (axis: SzogTrapAxis) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(
        [
          ['grain', 'Szál mentén', 'hosszú él'],
          ['cross', 'Kereszt mentén', 'széles él (bal/jobb)']
        ] as const
      ).map(([id, label, hint]) => {
        const on = value === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(id)}
            className={cn(
              'flex h-14 flex-col items-center justify-center rounded-md border px-2',
              on
                ? 'border-ink bg-ink text-white'
                : 'border-border bg-surface text-ink hover:bg-subtle',
              disabled && 'opacity-50'
            )}
          >
            <span className="text-[13px] font-semibold">{label}</span>
            <span
              className={cn(
                'text-[11px]',
                on ? 'text-white/80' : 'text-ink-muted'
              )}
            >
              {hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function SzogvagasShapeFields({
  grainMm,
  crossMm,
  kind,
  trapShortMm,
  trapAxis,
  corners,
  disabled,
  error,
  onKindChange,
  onTrapShortChange,
  onTrapAxisChange,
  onEnter
}: Props) {
  const [draftShort, setDraftShort] = useState<string | null>(null)
  const shape = szogShapeLabelForCorners(corners, grainMm, crossMm)
  const parallelFull = szogTrapParallelFullMm(trapAxis, grainMm, crossMm)
  const heightLabel =
    trapAxis === 'grain'
      ? `magasság = ${crossMm} mm`
      : `szélesség = ${grainMm} mm`

  return (
    <div className="space-y-3 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
      <div>
        <p className="text-body font-medium text-ink">Szögvágás — kész alak</p>
        <p className="text-hint text-ink-secondary">
          Szabás: {grainMm} × {crossMm} mm. Trapéznál a rövid él a szál vagy a
          kereszt (széles) oldalon lehet.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-hint font-medium text-ink-secondary">
          1. Kész alak
        </p>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Kész alak">
          {(
            [
              ['trapezoid', 'Trapéz'],
              ['triangle', 'Háromszög']
            ] as const
          ).map(([id, label]) => {
            const on = kind === id
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => onKindChange(id)}
                className={cn(
                  'h-11 rounded-md border px-2 text-[13px] font-semibold transition-colors',
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-border bg-surface text-ink hover:bg-subtle',
                  disabled && 'opacity-50'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {kind === 'trapezoid' ? (
        <div className="space-y-2">
          <p className="text-hint font-medium text-ink-secondary">
            2. Hol a rövid él?
          </p>
          <AxisPicker
            value={trapAxis}
            disabled={disabled}
            onChange={onTrapAxisChange}
          />

          <p className="text-hint text-ink-muted">
            Hosszú párhuzamos = {parallelFull} mm · {heightLabel}.
          </p>

          <FormField
            label={
              trapAxis === 'grain'
                ? 'Kész rövid él (szál)'
                : 'Kész rövid él (széles / kereszt)'
            }
            htmlFor="opti-szog-trap-short"
            hint={`1–${parallelFull - 1} mm`}
            error={error}
          >
            <div className="flex max-w-xs items-center gap-1.5">
              <Input
                id="opti-szog-trap-short"
                inputMode="numeric"
                className="h-9 tabular-nums"
                disabled={disabled}
                value={draftShort ?? String(trapShortMm)}
                aria-invalid={error ? true : undefined}
                onFocus={() => setDraftShort(String(trapShortMm))}
                onBlur={() => setDraftShort(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setDraftShort(null)
                    onEnter?.()
                  }
                }}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  setDraftShort(digits)
                  onTrapShortChange(digits)
                }}
              />
              <span className="text-hint text-ink-muted">mm</span>
            </div>
          </FormField>

          <p className="text-hint text-ink-muted">
            {trapAxis === 'grain'
              ? 'A rövid él a felső szál-élen; a ferde balra (tükör / 180° ugyanaz).'
              : 'A rövid él a bal (széles) oldalon; a ferde a felsőn (tükör / 180° ugyanaz).'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-hint font-medium text-ink-secondary">
            2. Háromszög
          </p>
          <p className="text-hint text-ink-muted">
            Átló a {grainMm} × {crossMm} mm szabáson. Nincs külön irányváltó —
            a tükör / forgatás ugyanaz a kész darab.
          </p>
          {error ? (
            <p className="text-hint text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <p className="text-hint text-ink-secondary" aria-live="polite">
        {corners.length === 0
          ? 'Még nincs érvényes vágás.'
          : `Kész: ${shape}. Szabás: ${grainMm} × ${crossMm} mm téglalap.`}
      </p>
    </div>
  )
}
