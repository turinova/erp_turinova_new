'use client'

import { useMemo } from 'react'

import { SheetMaterialMenuSelect } from '@/components/opti/sheet-material-menu-select'
import { FormField } from '@/components/patterns/form-field'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  edgeMaterialColor,
  panthelyEdgeIsHorizontal,
  panthelyEdgeMm,
  panthelyPositionsMm,
  type PanthelyOldal
} from '@/lib/opti/panel-draft'
import {
  maxCrossMm,
  maxGrainMm,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'
import {
  countSzogCuts,
  pointsToCssPolygon,
  pointsToSvgPolygon,
  szogCutSegments,
  szogDiagonalAnnotations,
  szogFinishedStraightEdgesMm,
  szogShapeLabelForCorners,
  szogStraightEdgeSegments,
  SZOG_CORNER_LABELS,
  szogvagasPolygonPoints,
  type SzogCornerCut,
  type SzogCornerId,
  type SzogStraightEdgeId
} from '@/lib/opti/szogvagas-preview'
import { cn } from '@/lib/utils'

type MaterialPreviewColumnProps = {
  sheetMaterialId: string
  selectedMaterial: OptiSheetMaterialOption | null
  /** Kiválasztott / ismert anyagok a typeahead seedhez. */
  seedMaterials?: OptiSheetMaterialOption[]
  changing: boolean
  materialError?: string
  grainMm: number | null
  crossMm: number | null
  edgeAId: string
  edgeBId: string
  edgeCId: string
  edgeDId: string
  /** Szögvágás ferde (vágott) él élzárója */
  edgeFerdeId?: string
  panthely?: { count: number; oldal: PanthelyOldal } | null
  /** UI-only szögvágás sarok preview */
  szogvagas?: boolean
  szogCorners?: SzogCornerCut[]
  /** Sarok választás a preview-n (max 1). */
  onSelectSzogCorner?: (corner: SzogCornerId) => void
  szogCornerSelectDisabled?: boolean
  onChangeMaterialId: (
    id: string,
    material: OptiSheetMaterialOption | null
  ) => void
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
  seedMaterials = [],
  changing,
  materialError,
  grainMm,
  crossMm,
  edgeAId,
  edgeBId,
  edgeCId,
  edgeDId,
  edgeFerdeId = '',
  panthely = null,
  szogvagas = false,
  szogCorners = [],
  onSelectSzogCorner,
  szogCornerSelectDisabled = false,
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

  const pickerSeed = useMemo(() => {
    const byId = new Map<string, OptiSheetMaterialOption>()
    for (const m of seedMaterials) byId.set(m.id, m)
    if (selectedMaterial) byId.set(selectedMaterial.id, selectedMaterial)
    return [...byId.values()]
  }, [seedMaterials, selectedMaterial])

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

  const hingeDots = useMemo(() => {
    if (!hasDims || !panthely || panthely.count < 2) return []
    const g = grainMm as number
    const c = crossMm as number
    const horizontal = panthelyEdgeIsHorizontal(g, c, panthely.oldal)
    const edgeMm = panthelyEdgeMm(g, c, panthely.oldal)
    const pxPerMm = horizontal ? size.width / g : size.height / c
    const inset = Math.max(7, 22.5 * (size.width / g))
    return panthelyPositionsMm(edgeMm, panthely.count).map((mm) =>
      horizontal
        ? { left: mm * pxPerMm, top: inset }
        : { left: inset, top: size.height - mm * pxPerMm }
    )
  }, [hasDims, panthely, grainMm, crossMm, size])

  const szogCutCount = szogvagas ? countSzogCuts(szogCorners) : 0
  const szogActive = szogvagas && szogCutCount > 0 && hasDims
  const activeSzogCorner: SzogCornerId | null =
    szogCorners.find((c) => c.alongGrainMm > 0 || c.alongCrossMm > 0)?.corner ??
    szogCorners[0]?.corner ??
    null
  const showSzogCornerHits =
    Boolean(szogvagas && hasDims && onSelectSzogCorner) && !szogCornerSelectDisabled
  const szogPoints = useMemo(() => {
    if (!szogActive || !hasDims) return []
    return szogvagasPolygonPoints(
      size.width,
      size.height,
      grainMm as number,
      crossMm as number,
      szogCorners
    )
  }, [szogActive, szogCorners, hasDims, size, grainMm, crossMm])
  const szogPolygon = pointsToSvgPolygon(szogPoints)
  const szogClip = pointsToCssPolygon(szogPoints)
  const szogSegments = useMemo(() => {
    if (!szogActive || !hasDims) return []
    return szogCutSegments(
      size.width,
      size.height,
      grainMm as number,
      crossMm as number,
      szogCorners
    )
  }, [szogActive, szogCorners, hasDims, size, grainMm, crossMm])
  const szogDiagonals = useMemo(() => {
    if (!szogActive || !hasDims) return []
    return szogDiagonalAnnotations(
      size.width,
      size.height,
      grainMm as number,
      crossMm as number,
      szogCorners
    )
  }, [szogActive, szogCorners, hasDims, size, grainMm, crossMm])
  const finishedEdges = useMemo(() => {
    if (!hasDims) {
      return { top: null, bottom: null, left: null, right: null }
    }
    if (!szogActive) {
      return {
        top: grainMm as number,
        bottom: grainMm as number,
        left: crossMm as number,
        right: crossMm as number
      }
    }
    return szogFinishedStraightEdgesMm(
      grainMm as number,
      crossMm as number,
      szogCorners
    )
  }, [hasDims, szogActive, grainMm, crossMm, szogCorners])

  const straightSegs = useMemo(() => {
    if (!szogActive || !hasDims) return []
    return szogStraightEdgeSegments(
      size.width,
      size.height,
      grainMm as number,
      crossMm as number,
      szogCorners
    )
  }, [szogActive, hasDims, size, grainMm, crossMm, szogCorners])

  const materialImage = selectedMaterial?.image_url
    ? `url(${selectedMaterial.image_url})`
    : undefined

  const colorA = edgeMaterialColor(edgeAId || null)
  const colorB = edgeMaterialColor(edgeBId || null)
  const colorC = edgeMaterialColor(edgeCId || null)
  const colorD = edgeMaterialColor(edgeDId || null)
  const colorFerde = edgeMaterialColor(edgeFerdeId || null)
  const ferdeEdged = Boolean(edgeFerdeId)

  function edgeColorForSide(side: SzogStraightEdgeId): string {
    switch (side) {
      case 'top':
        return colorA
      case 'right':
        return colorB
      case 'bottom':
        return colorC
      case 'left':
        return colorD
    }
  }

  function edgeIdForSide(side: SzogStraightEdgeId): string {
    switch (side) {
      case 'top':
        return edgeAId
      case 'right':
        return edgeBId
      case 'bottom':
        return edgeCId
      case 'left':
        return edgeDId
    }
  }

  function edgeLabelForSide(side: SzogStraightEdgeId): string {
    switch (side) {
      case 'top':
        return 'Hosszú felső'
      case 'right':
        return 'Széles jobb'
      case 'bottom':
        return 'Hosszú alsó'
      case 'left':
        return 'Széles bal'
    }
  }

  const szogEdgeUi = useMemo(() => {
    if (!szogActive) return []
    return straightSegs.map((seg) => {
      const edged = Boolean(edgeIdForSide(seg.side))
      return {
        ...seg,
        edged,
        color: edged ? edgeColorForSide(seg.side) : '#64748b',
        label: edgeLabelForSide(seg.side)
      }
    })
  }, [
    szogActive,
    straightSegs,
    edgeAId,
    edgeBId,
    edgeCId,
    edgeDId,
    colorA,
    colorB,
    colorC,
    colorD
  ])

  const showMaxChip =
    selectedMaterial &&
    maxGrain !== null &&
    maxCross !== null &&
    (maxGrain !== selectedMaterial.length_mm ||
      maxCross !== selectedMaterial.width_mm)

  const awaitingMaterial = !selectedMaterial
  const highlightPicker = awaitingMaterial && !materialError

  return (
    <section
      className={cn(
        'flex flex-col gap-2.5 rounded-md border bg-surface p-3',
        highlightPicker
          ? 'border-ink ring-1 ring-ink/15'
          : materialError
            ? 'border-danger/40'
            : 'border-border',
        className
      )}
    >
      {awaitingMaterial ? (
        <div className="rounded-md border border-border bg-subtle px-2.5 py-2">
          <p className="text-body font-medium text-ink">
            1. lépés — válassz táblás anyagot
          </p>
          <p className="mt-0.5 text-hint text-ink-secondary">
            Anyag nélkül a méreteket nem tudod megadni.
          </p>
        </div>
      ) : null}

      {showPicker ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField
            label="Táblás anyag"
            htmlFor="opti-sheet"
            required
            error={materialError}
            className="min-w-0 flex-1"
          >
            <SheetMaterialMenuSelect
              id="opti-sheet"
              value={sheetMaterialId}
              seed={pickerSeed}
              placeholder="Válassz anyagot…"
              onChange={onChangeMaterialId}
              selectClassName={
                highlightPicker
                  ? '[&>button]:border-ink [&>button]:ring-1 [&>button]:ring-ink/20'
                  : undefined
              }
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
            border: szogActive ? 'none' : '2px solid #64748b',
            backgroundColor: szogActive ? '#e8eaed' : fill,
            backgroundImage: !szogActive ? materialImage : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Kész alak: anyagkép clipelve — 0…W×H, ugyanaz mint az SVG nest */}
          {szogActive && szogClip ? (
            <div
              className="pointer-events-none absolute left-0 top-0 z-[1]"
              style={{
                width: size.width,
                height: size.height,
                backgroundColor: fill,
                backgroundImage: materialImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                clipPath: szogClip
              }}
              aria-hidden
            >
              {selectedMaterial?.grain_direction
                ? Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute left-[8%] right-[8%] h-px bg-white/55"
                      style={{ top: `${((i + 1) / 7) * 100}%` }}
                    />
                  ))
                : null}
            </div>
          ) : null}

          {szogActive ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-[2] overflow-visible"
              width={size.width}
              height={size.height}
              aria-hidden
            >
              {/* Szabás nest — ugyanaz a koordináta, mint a clip (nem CSS outline) */}
              <rect
                x={0.5}
                y={0.5}
                width={Math.max(0, size.width - 1)}
                height={Math.max(0, size.height - 1)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
              {szogPolygon ? (
                <polygon
                  points={szogPolygon}
                  fill="none"
                  stroke="#18181B"
                  strokeWidth={2}
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {/* Élzárás a kész egyenes éleken */}
              {szogEdgeUi
                .filter((seg) => seg.edged)
                .map((seg) => (
                  <line
                    key={`band-${seg.side}-${seg.a.x}-${seg.a.y}`}
                    x1={seg.a.x}
                    y1={seg.a.y}
                    x2={seg.b.x}
                    y2={seg.b.y}
                    stroke={seg.color}
                    strokeWidth={6}
                    strokeLinecap="butt"
                  />
                ))}
              {!ferdeEdged
                ? szogSegments.map((seg, i) => (
                    <line
                      key={`cut-${i}`}
                      x1={seg.a.x}
                      y1={seg.a.y}
                      x2={seg.b.x}
                      y2={seg.b.y}
                      stroke="#18181B"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  ))
                : null}
              {/* Ferde élzárás a vágott élen */}
              {ferdeEdged
                ? szogDiagonals.map((d) => (
                    <line
                      key={`ferde-band-${d.corner}`}
                      x1={d.a.x}
                      y1={d.a.y}
                      x2={d.b.x}
                      y2={d.b.y}
                      stroke={colorFerde}
                      strokeWidth={6}
                      strokeLinecap="butt"
                    />
                  ))
                : null}
            </svg>
          ) : null}

          {/* Sarok választás — nagy hit target a preview sarkain (max 1) */}
          {showSzogCornerHits
            ? (
                [
                  ['TL', 0, 0],
                  ['TR', size.width, 0],
                  ['BL', 0, size.height],
                  ['BR', size.width, size.height]
                ] as const
              ).map(([id, x, y]) => {
                const on = activeSzogCorner === id
                return (
                  <button
                    key={`hit-${id}`}
                    type="button"
                    aria-label={`${SZOG_CORNER_LABELS[id]} sarok`}
                    aria-pressed={on}
                    title={SZOG_CORNER_LABELS[id]}
                    disabled={szogCornerSelectDisabled}
                    onClick={() => onSelectSzogCorner?.(id)}
                    className={cn(
                      'absolute z-[6] size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition-colors',
                      on
                        ? 'border-ink bg-ink text-white'
                        : 'border-border bg-surface/95 text-ink hover:border-ink hover:bg-subtle'
                    )}
                    style={{ left: x, top: y }}
                  >
                    <span className="sr-only">{SZOG_CORNER_LABELS[id]}</span>
                    <span
                      className={cn(
                        'mx-auto block size-2 rounded-full',
                        on ? 'bg-white' : 'bg-ink'
                      )}
                      aria-hidden
                    />
                  </button>
                )
              })
            : null}

          {/* Ferde él címke (összevonva a régi átló-mm annotációval) */}
          {szogActive &&
            szogDiagonals.map((d) => (
              <span
                key={`ferde-lbl-${d.corner}`}
                className={cn(
                  'pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[10px] font-semibold leading-tight',
                  !ferdeEdged && 'opacity-50'
                )}
                style={{
                  left: d.mid.x,
                  top: d.mid.y,
                  color: ferdeEdged ? colorFerde : '#64748b'
                }}
              >
                <span className="block">Ferde</span>
                <span className="block tabular-nums text-ink">
                  {d.lengthMm} mm
                </span>
              </span>
            ))}

          {/* Él címkék a kész szakasz közepén (0 mm → nincs) */}
          {szogActive &&
            szogEdgeUi.map((seg) => {
              const offset =
                seg.side === 'top'
                  ? { x: 0, y: -18 }
                  : seg.side === 'bottom'
                    ? { x: 0, y: 18 }
                    : seg.side === 'left'
                      ? { x: -22, y: 0 }
                      : { x: 22, y: 0 }
              return (
                <span
                  key={`lbl-${seg.side}-${seg.a.x}-${seg.a.y}-${seg.b.x}-${seg.b.y}`}
                  className={cn(
                    'pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[10px] font-semibold leading-tight',
                    !seg.edged && 'opacity-50'
                  )}
                  style={{
                    left: seg.mid.x + offset.x,
                    top: seg.mid.y + offset.y,
                    color: seg.color
                  }}
                >
                  <span className="block">{seg.label}</span>
                  <span className="block tabular-nums text-ink">
                    {Math.round(seg.lengthMm)} mm
                  </span>
                </span>
              )
            })}

          {!szogActive && selectedMaterial?.grain_direction ? (
            <>
              {selectedMaterial.image_url ? (
                <span
                  className="pointer-events-none absolute inset-0 z-[1] bg-ink/20"
                  aria-hidden
                />
              ) : null}
              {Array.from({ length: 8 }, (_, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute left-[5%] right-[5%] z-[1] h-0.5 rounded-sm bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                  style={{ top: `${(i + 1) * 11}%` }}
                  aria-hidden
                />
              ))}
              <span className="pointer-events-none absolute bottom-1.5 left-1/2 z-[2] -translate-x-1/2 rounded bg-surface/95 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-ink shadow-sm">
                Szál →
              </span>
            </>
          ) : null}

          {szogActive && selectedMaterial?.grain_direction ? (
            <span className="pointer-events-none absolute bottom-1.5 left-1/2 z-[3] -translate-x-1/2 rounded bg-surface/95 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-ink shadow-sm">
              Szál →
            </span>
          ) : null}

          <span className="relative z-[3] rounded bg-surface/90 px-1.5 py-0.5 text-body font-medium tabular-nums text-ink shadow-sm">
            {hasDims
              ? szogActive
                ? `Szabás ${grainMm} × ${crossMm}`
                : `${grainMm} × ${crossMm}`
              : 'X × Y'}
          </span>

          {/* Téglalap mód: bbox élcímkék + inset csíkok */}
          {!szogActive ? (
            <>
              <EdgeLabel
                side="top"
                active={Boolean(edgeAId)}
                color={colorA}
                mm={finishedEdges.top}
              >
                Hosszú felső
              </EdgeLabel>
              <EdgeLabel
                side="bottom"
                active={Boolean(edgeCId)}
                color={colorC}
                mm={finishedEdges.bottom}
              >
                Hosszú alsó
              </EdgeLabel>
              <EdgeLabel
                side="left"
                active={Boolean(edgeDId)}
                color={colorD}
                mm={finishedEdges.left}
              >
                Széles bal
              </EdgeLabel>
              <EdgeLabel
                side="right"
                active={Boolean(edgeBId)}
                color={colorB}
                mm={finishedEdges.right}
              >
                Széles jobb
              </EdgeLabel>
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
            </>
          ) : null}

          {hingeDots.map((dot, i) => (
            <span
              key={i}
              className="absolute z-[4] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
              style={{ left: dot.left, top: dot.top }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {szogvagas ? (
        <div className="text-center" aria-live="polite">
          {szogCutCount === 0 ? (
            <p className="text-hint text-ink-muted">Kattints egy sarokra.</p>
          ) : szogActive && finishedEdges.top != null ? (
            <p className="text-[11px] tabular-nums text-ink-muted">
              {szogShapeLabelForCorners(
                szogCorners,
                grainMm as number,
                crossMm as number
              )}{' '}
              · F {Math.round(finishedEdges.top)} · A{' '}
              {Math.round(finishedEdges.bottom!)} · B{' '}
              {Math.round(finishedEdges.left!)} · J{' '}
              {Math.round(finishedEdges.right!)}
              {szogDiagonals.length > 0
                ? ` · ferde ${szogDiagonals.map((d) => d.lengthMm).join(', ')}`
                : ''}{' '}
              mm
            </p>
          ) : null}
        </div>
      ) : null}

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
            <StatusBadge tone="warning">Szálirány (vízszintes)</StatusBadge>
          ) : null}
          {showMaxChip ? (
            <StatusBadge tone="neutral">
              Max {maxGrain} × {maxCross} mm
            </StatusBadge>
          ) : null}
        </div>
      ) : (
        <p className="text-hint text-ink-secondary">
          A választás után itt jelenik meg az anyag előnézete.
        </p>
      )}
    </section>
  )
}

function EdgeLabel({
  side,
  color,
  active,
  mm,
  children
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  color: string
  active: boolean
  mm?: number | null
  children: string
}) {
  const position =
    side === 'top'
      ? 'absolute -top-7 left-1/2 z-[4] -translate-x-1/2'
      : side === 'bottom'
        ? 'absolute -bottom-7 left-1/2 z-[4] -translate-x-1/2'
        : side === 'left'
          ? 'absolute -left-7 top-1/2 z-[4] -translate-y-1/2 -rotate-90'
          : 'absolute -right-7 top-1/2 z-[4] -translate-y-1/2 rotate-90'

  return (
    <span
      className={cn(
        'whitespace-nowrap text-center text-[11px] font-semibold leading-tight',
        position,
        !active && 'opacity-50'
      )}
      style={{ color: active ? color : '#64748b' }}
    >
      <span className="block">{children}</span>
      {mm != null && Number.isFinite(mm) ? (
        <span className="block tabular-nums text-ink">{Math.round(mm)} mm</span>
      ) : null}
    </span>
  )
}
