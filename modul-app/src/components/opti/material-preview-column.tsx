'use client'

import { useMemo } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { MenuSelect } from '@/components/ui/menu-select'
import { edgeMaterialColor } from '@/lib/opti/panel-draft'
import {
  maxCrossMm,
  maxGrainMm,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'
import { cn } from '@/lib/utils'

type MaterialPreviewColumnProps = {
  sheetMaterialId: string
  selectedMaterial: OptiSheetMaterialOption | null
  sheetsByManufacturer: Array<[string, OptiSheetMaterialOption[]]>
  changing: boolean
  materialError?: string
  grainMm: number | null
  crossMm: number | null
  edgeAId: string
  edgeBId: string
  edgeCId: string
  edgeDId: string
  onChangeMaterialId: (id: string) => void
  onStartChange: () => void
  onCancelChange: () => void
  className?: string
}

function materialFillColor(name: string): string {
  const colors = [
    '#c4b5a0',
    '#a8b5c4',
    '#b7c4a8',
    '#c4a8b0',
    '#b0a89c',
    '#9caeb0',
    '#d4c4a8',
    '#a8a8b8'
  ]
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function MaterialPreviewColumn({
  sheetMaterialId,
  selectedMaterial,
  sheetsByManufacturer,
  changing,
  materialError,
  grainMm,
  crossMm,
  edgeAId,
  edgeBId,
  edgeCId,
  edgeDId,
  onChangeMaterialId,
  onStartChange,
  onCancelChange,
  className
}: MaterialPreviewColumnProps) {
  const showPicker = changing || !selectedMaterial
  const maxGrain = selectedMaterial ? maxGrainMm(selectedMaterial) : null
  const maxCross = selectedMaterial ? maxCrossMm(selectedMaterial) : null
  const fill = selectedMaterial
    ? materialFillColor(selectedMaterial.name)
    : '#e8eaed'

  const sheetOptions = useMemo(
    () =>
      sheetsByManufacturer.flatMap(([manufacturer, materials]) =>
        materials.map((m) => ({
          value: m.id,
          label: m.name,
          hint: `${m.thickness_mm} mm`,
          group: manufacturer
        }))
      ),
    [sheetsByManufacturer]
  )

  const hasDims =
    grainMm !== null &&
    crossMm !== null &&
    grainMm > 0 &&
    crossMm > 0

  const size = useMemo(() => {
    const g = hasDims ? (grainMm as number) : 100
    const c = hasDims ? (crossMm as number) : 100
    const aspectRatio = g / c
    const maxHeight = 200
    const maxWidth = 260
    if (aspectRatio > 1) {
      const width = Math.min(maxWidth, maxHeight * aspectRatio)
      return { width, height: width / aspectRatio }
    }
    const height = Math.min(maxHeight, maxWidth / aspectRatio)
    return { width: height * aspectRatio, height }
  }, [grainMm, crossMm, hasDims])

  const colorA = edgeMaterialColor(edgeAId || null)
  const colorB = edgeMaterialColor(edgeBId || null)
  const colorC = edgeMaterialColor(edgeCId || null)
  const colorD = edgeMaterialColor(edgeDId || null)

  const showMaxChip =
    selectedMaterial &&
    maxGrain !== null &&
    maxCross !== null &&
    (maxGrain !== selectedMaterial.length_mm ||
      maxCross !== selectedMaterial.width_mm)

  return (
    <section
      className={cn(
        'flex flex-col gap-2.5 rounded-md border border-border bg-surface p-3',
        className
      )}
    >
      {showPicker ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField
            label="Táblás anyag"
            htmlFor="opti-sheet"
            required
            error={materialError}
            className="min-w-0 flex-1"
          >
            <MenuSelect
              id="opti-sheet"
              value={sheetMaterialId}
              options={sheetOptions}
              placeholder="Válassz anyagot…"
              allowEmpty={false}
              onChange={onChangeMaterialId}
            />
          </FormField>
          {changing && selectedMaterial ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={onCancelChange}
            >
              Mégse
            </Button>
          ) : null}
        </div>
      ) : selectedMaterial ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-ink">
              {selectedMaterial.name}
            </p>
            <p className="text-hint text-ink-secondary">
              {selectedMaterial.manufacturer_name}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={onStartChange}
          >
            Váltás
          </Button>
        </div>
      ) : null}

      {/* overflow-visible + padding: élcímkék / csíkok látszanak */}
      <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-visible rounded-md border border-border bg-subtle px-10 py-12">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: size.width,
            height: size.height,
            border: '2px solid #64748b',
            backgroundColor: fill,
            backgroundImage: selectedMaterial?.image_url
              ? `url(${selectedMaterial.image_url})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {selectedMaterial?.grain_direction
            ? Array.from({ length: 8 }, (_, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute left-[5%] right-[5%] z-[1] h-px bg-ink/25"
                  style={{ top: `${(i + 1) * 12.5}%` }}
                  aria-hidden
                />
              ))
            : null}

          <span className="relative z-[2] rounded bg-surface/90 px-1.5 py-0.5 text-body font-medium tabular-nums text-ink shadow-sm">
            {hasDims ? `${grainMm} × ${crossMm}` : 'X × Y'}
          </span>

          <EdgeLabel side="top" active={Boolean(edgeAId)} color={colorA}>
            Hosszú felső
          </EdgeLabel>
          <EdgeLabel side="bottom" active={Boolean(edgeCId)} color={colorC}>
            Hosszú alsó
          </EdgeLabel>
          <EdgeLabel side="left" active={Boolean(edgeDId)} color={colorD}>
            Széles bal
          </EdgeLabel>
          <EdgeLabel side="right" active={Boolean(edgeBId)} color={colorB}>
            Széles jobb
          </EdgeLabel>

          {/* Inset élcsíkok — nem lógnak ki, nem vágja az overflow */}
          {edgeAId ? (
            <span
              className="absolute inset-x-0 top-0 z-[3] h-[5px]"
              style={{ backgroundColor: colorA }}
              aria-hidden
            />
          ) : null}
          {edgeCId ? (
            <span
              className="absolute inset-x-0 bottom-0 z-[3] h-[5px]"
              style={{ backgroundColor: colorC }}
              aria-hidden
            />
          ) : null}
          {edgeDId ? (
            <span
              className="absolute inset-y-0 left-0 z-[3] w-[5px]"
              style={{ backgroundColor: colorD }}
              aria-hidden
            />
          ) : null}
          {edgeBId ? (
            <span
              className="absolute inset-y-0 right-0 z-[3] w-[5px]"
              style={{ backgroundColor: colorB }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      {selectedMaterial ? (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge tone="neutral">
            {selectedMaterial.length_mm} × {selectedMaterial.width_mm} mm
          </StatusBadge>
          <StatusBadge tone="neutral">
            {selectedMaterial.thickness_mm} mm vastag
          </StatusBadge>
          <StatusBadge
            tone={selectedMaterial.on_stock ? 'success' : 'warning'}
          >
            {selectedMaterial.on_stock ? 'Raktári' : 'Rendelős'}
          </StatusBadge>
          {selectedMaterial.grain_direction ? (
            <StatusBadge tone="neutral">Szálirány</StatusBadge>
          ) : null}
          {showMaxChip ? (
            <StatusBadge tone="neutral">
              Max {maxGrain} × {maxCross} mm
            </StatusBadge>
          ) : null}
        </div>
      ) : (
        <p className="text-hint text-ink-secondary">
          Válassz táblás anyagot — a panel kitöltése mutatja az anyagot.
        </p>
      )}
    </section>
  )
}

function EdgeLabel({
  side,
  color,
  active,
  children
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  color: string
  active: boolean
  children: string
}) {
  const position =
    side === 'top'
      ? 'absolute -top-5 left-1/2 z-[4] -translate-x-1/2'
      : side === 'bottom'
        ? 'absolute -bottom-5 left-1/2 z-[4] -translate-x-1/2'
        : side === 'left'
          ? 'absolute -left-5 top-1/2 z-[4] -translate-y-1/2 -rotate-90'
          : 'absolute -right-5 top-1/2 z-[4] -translate-y-1/2 rotate-90'

  return (
    <span
      className={cn(
        'whitespace-nowrap text-[11px] font-semibold leading-none',
        position,
        !active && 'opacity-50'
      )}
      style={{ color: active ? color : '#64748b' }}
    >
      {children}
    </span>
  )
}
