'use client'

import { useMemo, type CSSProperties } from 'react'

import {
  panthelyEdgeIsHorizontal,
  panthelyEdgeMm,
  panthelyPositionsMm,
  type PanthelyOldal as OptiPanthelyOldal
} from '@/lib/opti/panel-draft'
import {
  pointsToCssPolygon,
  pointsToSvgPolygon,
  szogCutSegments,
  szogDiagonalAnnotations,
  szogFinishedStraightEdgesMm,
  szogStraightEdgeSegments,
  szogvagasPolygonPoints,
  type SzogCornerCut,
  type SzogCornerId as OptiSzogCornerId
} from '@/lib/opti/szogvagas-preview'
import {
  EDGE_STRAIGHT_UI,
  edgeSlotBadge,
  edgeSlotLabel
} from '@/lib/kiosk/edge-slots'
import {
  edgeAxisLabel,
  finishedEdgesCaption,
  MACHINING_COPY,
  SZOG_CORNER_UI
} from '@/lib/kiosk/machining-copy'
import { KIOSK_EDGE_TYPES } from '@/lib/kiosk/edge-types'
import type {
  EdgeSide,
  EdgeSlot,
  KioskMachining,
  SzogCornerId
} from '@/lib/kiosk/types'
import { cn } from '@/lib/utils'

/** Élzáró = meglévő kontúr vastagítása/színezése (nincs band layer). */
const EDGE_STROKE_PLAIN = 2.5
const EDGE_STROKE_BANDED = 6
const EDGE_COLOR_PLAIN = 'rgba(24, 24, 27, 0.35)'

function rectEdgeLine(
  side: EdgeSide,
  w: number,
  h: number
): { x1: number; y1: number; x2: number; y2: number } {
  switch (side) {
    case 'top':
      return { x1: 0, y1: 0, x2: w, y2: 0 }
    case 'right':
      return { x1: w, y1: 0, x2: w, y2: h }
    case 'bottom':
      return { x1: w, y1: h, x2: 0, y2: h }
    case 'left':
      return { x1: 0, y1: h, x2: 0, y2: 0 }
  }
}

const STAGE_INNER_W = 360
const STAGE_INNER_H = 280

const CORNER_HITS: Array<{
  id: SzogCornerId
  digit: string
  className: string
}> = SZOG_CORNER_UI.map((c) => ({
  id: c.id,
  digit: c.digit,
  className:
    c.id === 'TL'
      ? 'left-0 top-0 -translate-x-1/4 -translate-y-1/4'
      : c.id === 'TR'
        ? 'right-0 top-0 translate-x-1/4 -translate-y-1/4'
        : c.id === 'BL'
          ? 'bottom-0 left-0 -translate-x-1/4 translate-y-1/4'
          : 'bottom-0 right-0 translate-x-1/4 translate-y-1/4'
}))

function fitPanelSize(
  grainMm: number,
  crossMm: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const aspect = grainMm / crossMm
  if (aspect >= 1) {
    const width = Math.min(maxW, maxH * aspect)
    return { width, height: width / aspect }
  }
  const height = Math.min(maxH, maxW / aspect)
  return { width: height * aspect, height }
}

function panelFillStyle(
  imageUrl: string | null | undefined,
  swatch: string
): CSSProperties {
  if (imageUrl) {
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#e4e4e7'
    }
  }
  return { background: swatch }
}

type KioskMachiningPreviewProps = {
  grainMm: number
  crossMm: number
  swatch: string
  /** Tenant anyagkép — ha van, ez tölti a panelt (nem random swatch). */
  imageUrl?: string | null
  grainDirection: boolean
  quantity: number
  machining: KioskMachining | null
  onSelectSzogCorner?: (c: SzogCornerId) => void
  /** Él lépés: form dönt, preview csak vastagítja / címkézi az éleket */
  edgeIds?: Partial<Record<EdgeSlot, string>>
  caption?: string | null
  /** Él lépés: kisebb stage (kompakt tábla mellett) */
  compact?: boolean
}

export function KioskMachiningPreview({
  grainMm,
  crossMm,
  swatch,
  imageUrl = null,
  grainDirection,
  quantity,
  machining,
  onSelectSzogCorner,
  edgeIds,
  caption,
  compact = false
}: KioskMachiningPreviewProps) {
  const fill = panelFillStyle(imageUrl, swatch)
  const maxW = compact ? 300 : STAGE_INNER_W
  const maxH = compact ? 220 : STAGE_INNER_H
  const size = useMemo(
    () => fitPanelSize(grainMm, crossMm, maxW, maxH),
    [grainMm, crossMm, maxW, maxH]
  )

  const panthely = machining?.panthely ?? null
  const szog = machining?.szog ?? null
  const duplungolas = Boolean(machining?.duplungolas)

  const hingeDots = useMemo(() => {
    if (!panthely || panthely.quantity < 2) return []
    const oldal = panthely.oldal as OptiPanthelyOldal
    const horizontal = panthelyEdgeIsHorizontal(grainMm, crossMm, oldal)
    const edgeMm = panthelyEdgeMm(grainMm, crossMm, oldal)
    const pxPerMm = horizontal ? size.width / grainMm : size.height / crossMm
    const inset = Math.max(8, 22.5 * (size.width / grainMm))
    return panthelyPositionsMm(edgeMm, panthely.quantity).map((mm) =>
      horizontal
        ? { left: mm * pxPerMm, top: inset }
        : { left: inset, top: size.height - mm * pxPerMm }
    )
  }, [panthely, grainMm, crossMm, size])

  const szogCorners: SzogCornerCut[] = useMemo(() => {
    if (!szog) return []
    return [
      {
        corner: szog.corner as OptiSzogCornerId,
        alongGrainMm: szog.alongGrainMm,
        alongCrossMm: szog.alongCrossMm
      }
    ]
  }, [szog])

  const szogActive = szogCorners.length > 0
  const szogPoints = useMemo(() => {
    if (!szogActive) return []
    return szogvagasPolygonPoints(
      size.width,
      size.height,
      grainMm,
      crossMm,
      szogCorners
    )
  }, [szogActive, size, grainMm, crossMm, szogCorners])

  const szogPolygon = pointsToSvgPolygon(szogPoints)
  const szogClip = pointsToCssPolygon(szogPoints)
  const szogSegments = useMemo(() => {
    if (!szogActive) return []
    return szogCutSegments(
      size.width,
      size.height,
      grainMm,
      crossMm,
      szogCorners
    )
  }, [szogActive, size, grainMm, crossMm, szogCorners])

  const edgeSegs = useMemo(() => {
    if (!szogActive) return []
    return szogStraightEdgeSegments(
      size.width,
      size.height,
      grainMm,
      crossMm,
      szogCorners
    )
  }, [szogActive, size, grainMm, crossMm, szogCorners])

  const diagonals = useMemo(() => {
    if (!szogActive) return []
    return szogDiagonalAnnotations(
      size.width,
      size.height,
      grainMm,
      crossMm,
      szogCorners
    )
  }, [szogActive, size, grainMm, crossMm, szogCorners])

  const finished = useMemo(() => {
    if (!szogActive) return null
    return szogFinishedStraightEdgesMm(grainMm, crossMm, szogCorners)
  }, [szogActive, grainMm, crossMm, szogCorners])

  const showEdgeBands = edgeIds != null

  function edgeMeta(slot: EdgeSlot): { color: string } | null {
    const id = edgeIds?.[slot]
    if (!id) return null
    const edge = KIOSK_EDGE_TYPES.find((e) => e.id === id)
    if (!edge) return null
    return { color: edge.color }
  }

  return (
    <div className="flex flex-col rounded-2xl border-2 border-ink/20 bg-surface p-3 md:p-4">
      <div
        className={cn(
          'flex items-center justify-center overflow-visible rounded-xl bg-subtle',
          compact ? 'h-[280px] px-5 py-6' : 'h-[380px] px-8 py-10'
        )}
      >
        <div
          className={cn(
            'relative overflow-visible',
            !showEdgeBands && 'border-[3px] border-ink/45'
          )}
          style={{
            width: size.width,
            height: size.height,
            ...(szogActive ? { background: '#e8eaed' } : fill)
          }}
        >
          {szogActive ? (
            <svg
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
              width={size.width}
              height={size.height}
              aria-hidden
            >
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
            </svg>
          ) : null}

          {szogActive && szogClip ? (
            <div
              className="pointer-events-none absolute left-0 top-0 z-[1]"
              style={{
                width: size.width,
                height: size.height,
                ...fill,
                clipPath: szogClip
              }}
              aria-hidden
            >
              {grainDirection ? <GrainLines /> : null}
            </div>
          ) : grainDirection ? (
            <GrainLines />
          ) : null}

          {/* Megmunkálás: fekete kontúr. Él lépés: kontúr stroke élenként. */}
          {szogActive && !showEdgeBands ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-[2] overflow-visible"
              width={size.width}
              height={size.height}
              aria-hidden
            >
              {szogPolygon ? (
                <polygon
                  points={szogPolygon}
                  fill="none"
                  stroke="#18181B"
                  strokeWidth={2.5}
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {szogSegments.map((seg, i) => (
                <line
                  key={i}
                  x1={seg.a.x}
                  y1={seg.a.y}
                  x2={seg.b.x}
                  y2={seg.b.y}
                  stroke="#18181B"
                  strokeWidth={3}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          ) : null}

          {szogActive && showEdgeBands ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-[2] overflow-visible"
              width={size.width}
              height={size.height}
              aria-hidden
            >
              {szogSegments.map((seg, i) => (
                <line
                  key={`cut-${i}`}
                  x1={seg.a.x}
                  y1={seg.a.y}
                  x2={seg.b.x}
                  y2={seg.b.y}
                  stroke="#18181B"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {edgeSegs.map((seg) => {
                const meta = edgeMeta(seg.side as EdgeSide)
                return (
                  <line
                    key={`edge-${seg.side}`}
                    x1={seg.a.x}
                    y1={seg.a.y}
                    x2={seg.b.x}
                    y2={seg.b.y}
                    stroke={meta?.color ?? EDGE_COLOR_PLAIN}
                    strokeWidth={
                      meta ? EDGE_STROKE_BANDED : EDGE_STROKE_PLAIN
                    }
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
              {diagonals.map((d) => {
                const meta = edgeMeta('ferde')
                return (
                  <line
                    key={`ferde-${d.corner}`}
                    x1={d.a.x}
                    y1={d.a.y}
                    x2={d.b.x}
                    y2={d.b.y}
                    stroke={meta?.color ?? EDGE_COLOR_PLAIN}
                    strokeWidth={
                      meta ? EDGE_STROKE_BANDED : EDGE_STROKE_PLAIN
                    }
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </svg>
          ) : null}

          {/* Téglalap él lépés: kerület stroke élenként (nincs kitöltött sáv) */}
          {showEdgeBands && !szogActive ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-[2] overflow-visible"
              width={size.width}
              height={size.height}
              aria-hidden
            >
              {EDGE_STRAIGHT_UI.map(({ slot }) => {
                const meta = edgeMeta(slot)
                const line = rectEdgeLine(slot, size.width, size.height)
                return (
                  <line
                    key={`rect-${slot}`}
                    {...line}
                    stroke={meta?.color ?? EDGE_COLOR_PLAIN}
                    strokeWidth={
                      meta ? EDGE_STROKE_BANDED : EDGE_STROKE_PLAIN
                    }
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </svg>
          ) : null}

          {/* Él badge + mm (él lépés) / élhossz (megmunkálás) */}
          {showEdgeBands && !szogActive
            ? EDGE_STRAIGHT_UI.map(({ slot, badge, label }) => {
                const banded = Boolean(edgeMeta(slot))
                const lenMm =
                  slot === 'top' || slot === 'bottom' ? grainMm : crossMm
                const pos =
                  slot === 'top'
                    ? {
                        left: size.width / 2,
                        top: -14,
                        transform: 'translate(-50%, -100%)'
                      }
                    : slot === 'bottom'
                      ? {
                          left: size.width / 2,
                          top: size.height + 14,
                          transform: 'translate(-50%, 0)'
                        }
                      : slot === 'left'
                        ? {
                            left: -14,
                            top: size.height / 2,
                            transform: 'translate(-100%, -50%)'
                          }
                        : {
                            left: size.width + 14,
                            top: size.height / 2,
                            transform: 'translate(0, -50%)'
                          }
                return (
                  <span
                    key={`badge-${slot}`}
                    title={`${label}: ${lenMm} mm`}
                    className={cn(
                      'pointer-events-none absolute z-[6] flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums shadow-sm',
                      banded
                        ? 'bg-ink text-white'
                        : 'border border-border bg-white/95 text-ink'
                    )}
                    style={pos}
                  >
                    <span className="opacity-90">{badge}</span>
                    {lenMm} mm
                  </span>
                )
              })
            : null}

          {szogActive
            ? edgeSegs.map((seg) => {
                const slot = seg.side as EdgeSide
                const banded = showEdgeBands && Boolean(edgeMeta(slot))
                const offset =
                  slot === 'top'
                    ? { x: 0, y: -18 }
                    : slot === 'bottom'
                      ? { x: 0, y: 18 }
                      : slot === 'left'
                        ? { x: -36, y: 0 }
                        : { x: 36, y: 0 }
                return (
                  <span
                    key={`len-${slot}-${seg.lengthMm}`}
                    title={
                      showEdgeBands
                        ? `${edgeSlotLabel(slot)}: ${Math.round(seg.lengthMm)} mm`
                        : undefined
                    }
                    className={cn(
                      'pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums shadow-sm',
                      showEdgeBands && banded
                        ? 'bg-ink text-white'
                        : 'bg-white/95 text-ink'
                    )}
                    style={{
                      left: seg.mid.x + offset.x,
                      top: seg.mid.y + offset.y
                    }}
                  >
                    {showEdgeBands ? (
                      <>
                        <span className="font-bold">{edgeSlotBadge(slot)}</span>{' '}
                        {Math.round(seg.lengthMm)} mm
                      </>
                    ) : (
                      <>
                        {edgeAxisLabel(seg.side)} {Math.round(seg.lengthMm)} mm
                      </>
                    )}
                  </span>
                )
              })
            : null}

          {szogActive
            ? diagonals.map((d) => {
                const banded = showEdgeBands && Boolean(edgeMeta('ferde'))
                return (
                  <span
                    key={`ferde-len-${d.corner}`}
                    title={
                      showEdgeBands
                        ? `Ferde: ${d.lengthMm} mm`
                        : undefined
                    }
                    className={cn(
                      'pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums shadow-sm',
                      showEdgeBands && banded
                        ? 'bg-ink text-white'
                        : showEdgeBands
                          ? 'bg-white/95 text-ink'
                          : 'bg-ink text-white'
                    )}
                    style={{ left: d.mid.x, top: d.mid.y }}
                  >
                    {showEdgeBands ? (
                      <>
                        <span className="font-bold">F</span> {d.lengthMm} mm
                      </>
                    ) : (
                      <>Ferde {d.lengthMm} mm</>
                    )}
                  </span>
                )
              })
            : null}

          {!szogActive ? (
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/95 px-2.5 py-1 text-[14px] font-semibold tabular-nums text-ink shadow-sm">
              {grainMm} × {crossMm} mm
            </span>
          ) : null}

          {hingeDots.map((dot, i) => (
            <span
              key={i}
              className="pointer-events-none absolute z-[4] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface shadow-sm"
              style={{ left: dot.left, top: dot.top }}
              aria-hidden
            />
          ))}

          {duplungolas ? (
            <span className="pointer-events-none absolute left-2 top-2 z-[5] rounded-md bg-ink px-2 py-1 text-[12px] font-semibold text-white">
              {MACHINING_COPY.previewDuplungBadge(quantity)}
            </span>
          ) : null}

          {szogActive && onSelectSzogCorner
            ? CORNER_HITS.map((h) => {
                const active = szog?.corner === h.id
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={h.digit === '1' ? 'Sarok 1' : `Sarok ${h.digit}`}
                    aria-pressed={active}
                    onClick={() => onSelectSzogCorner(h.id)}
                    className={cn(
                      'absolute z-[6] flex size-11 items-center justify-center rounded-full border-2 text-[15px] font-bold transition',
                      h.className,
                      active
                        ? 'border-ink bg-ink text-white ring-2 ring-ink/30'
                        : 'border-ink/50 bg-white/90 text-ink hover:border-ink'
                    )}
                  >
                    {h.digit}
                  </button>
                )
              })
            : null}
        </div>
      </div>

      <div className="mt-2 space-y-1 text-center" aria-live="polite">
        {caption != null ? (
          caption ? (
            <p className="text-[14px] font-medium text-ink-secondary">{caption}</p>
          ) : null
        ) : szogActive && finished ? (
          <p className="text-[14px] font-medium tabular-nums text-ink-secondary">
            {finishedEdgesCaption({
              top: finished.top,
              bottom: finished.bottom,
              left: finished.left,
              right: finished.right,
              ferdeMm: diagonals.map((d) => d.lengthMm)
            })}
          </p>
        ) : duplungolas && !panthely ? (
          <p className="text-[14px] font-medium text-ink-secondary">
            {MACHINING_COPY.previewDuplungCaption}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function GrainLines() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute left-[8%] right-[8%] z-[1] h-0.5 rounded-sm bg-white/70"
          style={{ top: `${((i + 1) / 7) * 100}%` }}
          aria-hidden
        />
      ))}
    </>
  )
}
