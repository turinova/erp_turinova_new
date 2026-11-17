'use client'

import { Input } from '@/components/ui/input'
import {
  SZOG_CORNERS,
  szogCornerMeta,
  szogShapeWord,
  type SzogCornerCut,
  type SzogCornerId
} from '@/lib/opti/szogvagas'
import { cn } from '@/lib/utils'

type Props = {
  enabled: boolean
  grainMm: number | null
  crossMm: number | null
  cuts: SzogCornerCut[]
  error?: string
  disabled?: boolean
  onChange: (cuts: SzogCornerCut[]) => void
}

function cutFor(
  cuts: SzogCornerCut[],
  id: SzogCornerId
): SzogCornerCut | undefined {
  return cuts.find((c) => c.corner === id)
}

export function SzogvagasEditor({
  enabled,
  grainMm,
  crossMm,
  cuts,
  error,
  disabled = false,
  onChange
}: Props) {
  if (!enabled) return null

  function toggleCorner(id: SzogCornerId) {
    const existing = cutFor(cuts, id)
    if (existing) {
      onChange(cuts.filter((c) => c.corner !== id))
      return
    }
    const g = grainMm && grainMm > 0 ? grainMm : 0
    const c = crossMm && crossMm > 0 ? crossMm : 0
    const default1 = c > 0 ? Math.min(Math.round(c * 0.7), c - 1) : 0
    const default2 = g > 0 ? Math.min(Math.round(g * 0.7), g - 1) : 0
    onChange([
      ...cuts,
      {
        corner: id,
        remainEdge1Mm: default1 > 0 ? default1 : 0,
        remainEdge2Mm: default2 > 0 ? default2 : 0
      }
    ])
  }

  function updateRemain(
    id: SzogCornerId,
    field: 'remainEdge1Mm' | 'remainEdge2Mm',
    raw: string
  ) {
    const n = Number(raw.replace(',', '.'))
    const value = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
    onChange(
      cuts.map((c) => (c.corner === id ? { ...c, [field]: value } : c))
    )
  }

  const shape = szogShapeWord(cuts.length)

  return (
    <div className="space-y-3 rounded-md border border-border bg-subtle/40 px-3 py-3">
      <div>
        <p className="text-body font-medium text-ink">Szögvágás</p>
        <p className="mt-0.5 text-hint text-ink-secondary">
          Válaszd a sarkot, írd be mennyi marad a két élen. A szabásméret a
          téglalap marad — a ferde rész a megmunkálás.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-hint font-medium text-ink-secondary">
          1. Melyik sarkot vágod?
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Szögvágás sarkok"
        >
          {SZOG_CORNERS.map((c) => {
            const on = Boolean(cutFor(cuts, c.id))
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => toggleCorner(c.id)}
                className={cn(
                  'flex h-11 items-center justify-center rounded-md border px-2 text-[14px] font-medium transition-colors',
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-border bg-surface text-ink hover:bg-subtle',
                  disabled && 'opacity-50'
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {cuts.length === 0 ? (
        <p className="text-hint text-ink-muted" role="status">
          Jelölj meg legalább egy sarkot.
        </p>
      ) : (
        <p className="text-hint text-ink-secondary" aria-live="polite">
          {cuts.length} szögvágás — a lap {shape} lesz.
        </p>
      )}

      {cuts.map((cut) => {
        const meta = szogCornerMeta(cut.corner)
        return (
          <div
            key={cut.corner}
            className="space-y-2 rounded-md border border-border bg-surface px-3 py-2.5"
          >
            <p className="text-body font-medium text-ink">{meta.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-hint text-ink-secondary">
                  {meta.edge1Label}
                </span>
                <div className="flex items-center gap-1.5">
                  <Input
                    inputMode="numeric"
                    className="h-10 tabular-nums"
                    value={cut.remainEdge1Mm || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRemain(cut.corner, 'remainEdge1Mm', e.target.value)
                    }
                  />
                  <span className="text-hint text-ink-muted">mm</span>
                </div>
              </label>
              <label className="block space-y-1">
                <span className="text-hint text-ink-secondary">
                  {meta.edge2Label}
                </span>
                <div className="flex items-center gap-1.5">
                  <Input
                    inputMode="numeric"
                    className="h-10 tabular-nums"
                    value={cut.remainEdge2Mm || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRemain(cut.corner, 'remainEdge2Mm', e.target.value)
                    }
                  />
                  <span className="text-hint text-ink-muted">mm</span>
                </div>
              </label>
            </div>
          </div>
        )
      })}

      {error ? (
        <p className="text-hint text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
