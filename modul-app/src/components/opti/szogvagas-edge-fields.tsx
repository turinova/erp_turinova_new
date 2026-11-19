'use client'

import { useEffect, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import {
  SZOG_CORNER_LABELS,
  SZOG_CORNER_ORDER,
  remainFromCut,
  szogCornerEdgeLabels,
  validateSzogCorners,
  type SzogCornerCut,
  type SzogCornerId
} from '@/lib/opti/szogvagas-preview'

type Props = {
  grainMm: number | null
  crossMm: number | null
  corners: SzogCornerCut[]
  disabled?: boolean
  onChangeCorner: (
    corner: SzogCornerId,
    field: 'remainGrainMm' | 'remainCrossMm',
    raw: string
  ) => void
  onBlurCorner?: (corner: SzogCornerId) => void
  onEnter?: () => void
}

type DraftKey = `${SzogCornerId}:grain` | `${SzogCornerId}:cross`

/** Rövid élcímke: „Felső — marad”. */
function shortRemainLabel(edgeName: string): string {
  const short = edgeName.replace(/\s*él\s*$/i, '').trim()
  return `${short} — marad`
}

export function SzogvagasEdgeFields({
  grainMm,
  crossMm,
  corners,
  disabled,
  onChangeCorner,
  onBlurCorner,
  onEnter
}: Props) {
  const ready = grainMm != null && crossMm != null && grainMm > 0 && crossMm > 0
  const byId = new Map(corners.map((c) => [c.corner, c]))
  const activeId = SZOG_CORNER_ORDER.find((id) => byId.has(id)) ?? null
  const errors = ready ? validateSzogCorners(corners, grainMm, crossMm) : []
  const errorByCorner = new Map(errors.map((e) => [e.corner, e.message]))

  const [drafts, setDrafts] = useState<Partial<Record<DraftKey, string>>>({})
  const [focused, setFocused] = useState<DraftKey | null>(null)

  useEffect(() => {
    const active = new Set(corners.map((c) => c.corner))
    setDrafts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const key of Object.keys(next) as DraftKey[]) {
        const corner = key.split(':')[0] as SzogCornerId
        if (!active.has(corner)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [corners])

  function displayRemain(
    id: SzogCornerId,
    axis: 'grain' | 'cross',
    committed: number
  ): string {
    const key: DraftKey = `${id}:${axis}`
    if (focused === key && drafts[key] != null) return drafts[key]!
    return String(committed)
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
      {!ready ? (
        <p className="text-hint text-warning-ink">
          Előbb add meg a szál × kereszt méretet.
        </p>
      ) : !activeId ? (
        <p className="text-hint text-ink-muted">
          Kattints egy sarokra a rajzon.
        </p>
      ) : (
        SZOG_CORNER_ORDER.filter((id) => byId.has(id)).map((id) => {
          const cut = byId.get(id)!
          const labels = szogCornerEdgeLabels(id)
          const remainGrain = remainFromCut(grainMm, cut.alongGrainMm)
          const remainCross = remainFromCut(crossMm, cut.alongCrossMm)
          const err = errorByCorner.get(id)

          function bindField(
            axis: 'grain' | 'cross',
            field: 'remainGrainMm' | 'remainCrossMm',
            committed: number
          ) {
            const key: DraftKey = `${id}:${axis}`
            return {
              value: displayRemain(id, axis, committed),
              onFocus: () => {
                setFocused(key)
                setDrafts((d) => ({ ...d, [key]: String(committed) }))
              },
              onChange: (raw: string) => {
                const digits = raw.replace(/\D/g, '')
                setDrafts((d) => ({ ...d, [key]: digits }))
                onChangeCorner(id, field, digits)
              },
              onBlur: () => {
                setFocused(null)
                setDrafts((d) => {
                  const next = { ...d }
                  delete next[key]
                  return next
                })
                onBlurCorner?.(id)
              }
            }
          }

          const grainField = bindField('grain', 'remainGrainMm', remainGrain)
          const crossField = bindField('cross', 'remainCrossMm', remainCross)

          return (
            <div key={id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-body font-medium text-ink">
                  {SZOG_CORNER_LABELS[id]}
                </p>
                <p className="text-hint text-ink-muted">0 = élvégig</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField
                  label={shortRemainLabel(labels.grain)}
                  htmlFor={`opti-szog-${id}-grain`}
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      id={`opti-szog-${id}-grain`}
                      inputMode="numeric"
                      className="h-9 tabular-nums"
                      disabled={disabled}
                      value={grainField.value}
                      aria-invalid={err ? true : undefined}
                      onFocus={grainField.onFocus}
                      onBlur={grainField.onBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          onEnter?.()
                        }
                      }}
                      onChange={(e) => grainField.onChange(e.target.value)}
                    />
                    <span className="text-hint text-ink-muted">mm</span>
                  </div>
                </FormField>
                <FormField
                  label={shortRemainLabel(labels.cross)}
                  htmlFor={`opti-szog-${id}-cross`}
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      id={`opti-szog-${id}-cross`}
                      inputMode="numeric"
                      className="h-9 tabular-nums"
                      disabled={disabled}
                      value={crossField.value}
                      aria-invalid={err ? true : undefined}
                      onFocus={crossField.onFocus}
                      onBlur={crossField.onBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          onEnter?.()
                        }
                      }}
                      onChange={(e) => crossField.onChange(e.target.value)}
                    />
                    <span className="text-hint text-ink-muted">mm</span>
                  </div>
                </FormField>
              </div>
              {err ? (
                <p className="text-hint text-danger-ink" role="alert">
                  {err}
                </p>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}
