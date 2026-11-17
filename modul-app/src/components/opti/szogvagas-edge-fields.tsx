'use client'

import { useEffect, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import {
  SZOG_CORNER_LABELS,
  SZOG_CORNER_ORDER,
  countSzogCuts,
  isSzogFullDiagonal,
  remainFromCut,
  szogCornerAvailability,
  szogCornerEdgeLabels,
  szogFinishedStraightEdgesMm,
  szogMaxAlongMm,
  szogShapeLabelForCorners,
  validateSzogCorners,
  type SzogCornerCut,
  type SzogCornerId
} from '@/lib/opti/szogvagas-preview'
import { cn } from '@/lib/utils'

type Props = {
  grainMm: number | null
  crossMm: number | null
  corners: SzogCornerCut[]
  disabled?: boolean
  onToggleCorner: (corner: SzogCornerId) => void
  onChangeCorner: (
    corner: SzogCornerId,
    field: 'remainGrainMm' | 'remainCrossMm',
    raw: string
  ) => void
  onBlurCorner?: (corner: SzogCornerId) => void
  onEnter?: () => void
}

type DraftKey = `${SzogCornerId}:grain` | `${SzogCornerId}:cross`

export function SzogvagasEdgeFields({
  grainMm,
  crossMm,
  corners,
  disabled,
  onToggleCorner,
  onChangeCorner,
  onBlurCorner,
  onEnter
}: Props) {
  const ready = grainMm != null && crossMm != null && grainMm > 0 && crossMm > 0
  const byId = new Map(corners.map((c) => [c.corner, c]))
  const cuts = countSzogCuts(corners)
  const shape = ready
    ? szogShapeLabelForCorners(corners, grainMm, crossMm)
    : 'téglalap'
  const errors =
    ready ? validateSzogCorners(corners, grainMm, crossMm) : []
  const errorByCorner = new Map(errors.map((e) => [e.corner, e.message]))
  const availability = ready
    ? szogCornerAvailability(corners, grainMm, crossMm)
    : null
  const finished = ready
    ? szogFinishedStraightEdgesMm(grainMm, crossMm, corners)
    : null

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
    <div className="space-y-3 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
      <div>
        <p className="text-body font-medium text-ink">Szögvágás — sarok</p>
        <p className="text-hint text-ink-secondary">
          Add meg a <span className="font-medium">végleges megmaradó</span>{' '}
          élhosszakat (ami a kész bútorlapon lesz) — nem a levágott darabot. 0 =
          élvégig; 0 × 0 = átlós háromszög.
        </p>
      </div>

      {!ready ? (
        <p className="text-hint text-warning-ink">
          Előbb add meg a szál × kereszt méretet.
        </p>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-hint font-medium text-ink-secondary">
              1. Melyik sarkot vágod?
            </p>
            <div
              className="grid grid-cols-2 gap-1.5"
              role="group"
              aria-label="Szögvágás sarkok"
            >
              {SZOG_CORNER_ORDER.map((id) => {
                const on = byId.has(id)
                const avail = availability?.[id]
                const blocked = !on && avail != null && !avail.enabled
                const btnDisabled = Boolean(disabled || blocked)
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={btnDisabled}
                    aria-pressed={on}
                    title={
                      blocked
                        ? avail?.reason
                        : on
                          ? 'Kattints a kikapcsoláshoz'
                          : undefined
                    }
                    onClick={() => {
                      if (blocked) return
                      onToggleCorner(id)
                    }}
                    className={cn(
                      'h-11 rounded-md border px-2 text-[13px] font-semibold transition-colors',
                      on
                        ? 'border-ink bg-ink text-white'
                        : blocked
                          ? 'cursor-not-allowed border-border bg-subtle text-ink-muted opacity-50'
                          : 'border-border bg-surface text-ink hover:bg-subtle',
                      disabled && 'opacity-50'
                    )}
                  >
                    {SZOG_CORNER_LABELS[id]}
                  </button>
                )
              })}
            </div>
            {availability
              ? SZOG_CORNER_ORDER.filter(
                  (id) => !byId.has(id) && !availability[id].enabled
                )
                  .slice(0, 1)
                  .map((id) => (
                    <p
                      key={`why-${id}`}
                      className="mt-1.5 text-hint text-ink-muted"
                    >
                      {availability[id].reason}
                    </p>
                  ))
              : null}
          </div>

          {corners.length === 0 ? (
            <p className="text-hint text-ink-muted">
              Jelölj meg legalább egy sarkot.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-hint font-medium text-ink-secondary">
                2. Végleges (kész) élhossz
              </p>
              {SZOG_CORNER_ORDER.filter((id) => byId.has(id)).map((id) => {
                const cut = byId.get(id)!
                const labels = szogCornerEdgeLabels(id)
                const remainGrain = remainFromCut(grainMm, cut.alongGrainMm)
                const remainCross = remainFromCut(crossMm, cut.alongCrossMm)
                const triangle = isSzogFullDiagonal(cut, grainMm, crossMm)
                const maxAlongG = szogMaxAlongMm(
                  id,
                  'grain',
                  corners,
                  grainMm,
                  crossMm
                )
                const maxAlongC = szogMaxAlongMm(
                  id,
                  'cross',
                  corners,
                  grainMm,
                  crossMm
                )
                // Kész min = full − max levágás (szomszéd miatt)
                const minRemainG = Math.max(0, grainMm - maxAlongG)
                const minRemainC = Math.max(0, crossMm - maxAlongC)
                const err = errorByCorner.get(id)
                const fullG = cut.alongGrainMm >= grainMm
                const fullC = cut.alongCrossMm >= crossMm

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

                const grainField = bindField(
                  'grain',
                  'remainGrainMm',
                  remainGrain
                )
                const crossField = bindField(
                  'cross',
                  'remainCrossMm',
                  remainCross
                )

                return (
                  <div
                    key={id}
                    className="space-y-2 rounded-md border border-border bg-surface px-2.5 py-2"
                  >
                    <p className="text-body font-medium text-ink">
                      {SZOG_CORNER_LABELS[id]}
                      {triangle ? (
                        <span className="ml-1.5 text-hint font-normal text-ink-secondary">
                          · háromszög
                        </span>
                      ) : fullG || fullC ? (
                        <span className="ml-1.5 text-hint font-normal text-ink-secondary">
                          · élvégig
                        </span>
                      ) : null}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <FormField
                        label={`${labels.grain} — kész`}
                        htmlFor={`opti-szog-${id}-grain`}
                        hint={`0–${grainMm} mm · 0 = élvégig · min ${minRemainG} (szomszéd)`}
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
                        label={`${labels.cross} — kész`}
                        htmlFor={`opti-szog-${id}-cross`}
                        hint={`0–${crossMm} mm · 0 = élvégig · min ${minRemainC} (szomszéd)`}
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
                    ) : triangle ? (
                      <p className="text-hint text-ink-muted">
                        Átló háromszög · kész 0 × 0 · szabás {grainMm} ×{' '}
                        {crossMm} mm.
                      </p>
                    ) : (
                      <p className="text-hint text-ink-muted">
                        Számított levágás a saroktól: {cut.alongGrainMm} ×{' '}
                        {cut.alongCrossMm} mm.
                      </p>
                    )}
                  </div>
                )
              })}

              {finished && cuts > 0 ? (
                <div className="rounded-md border border-border bg-subtle/60 px-2.5 py-2">
                  <p className="text-hint font-medium text-ink-secondary">
                    Kész egyenes élek (összesen a rajzon)
                  </p>
                  <p className="mt-0.5 text-[12px] tabular-nums text-ink">
                    Felső {Math.round(finished.top)} · Alsó{' '}
                    {Math.round(finished.bottom)} · Bal{' '}
                    {Math.round(finished.left)} · Jobb{' '}
                    {Math.round(finished.right)} mm
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <p className="text-hint text-ink-secondary" aria-live="polite">
            {cuts === 0
              ? 'Még nincs élvágás.'
              : `${cuts} élvágás · ${shape}. Szabás: ${grainMm} × ${crossMm} mm téglalap.`}
          </p>
        </>
      )}
    </div>
  )
}
