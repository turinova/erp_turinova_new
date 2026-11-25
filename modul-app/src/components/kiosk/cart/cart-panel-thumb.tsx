'use client'

import { useMemo, type CSSProperties } from 'react'

import type { KioskMachining } from '@/lib/kiosk/types'
import {
  pointsToCssPolygon,
  pointsToSvgPolygon,
  szogvagasPolygonPoints,
  type SzogCornerCut
} from '@/lib/opti/szogvagas-preview'
import { cn } from '@/lib/utils'

const MAX_W = 80
const MAX_H = 64

function fitSize(
  grainMm: number,
  crossMm: number
): { width: number; height: number } {
  const g = Math.max(1, grainMm)
  const c = Math.max(1, crossMm)
  const aspect = g / c
  if (aspect >= 1) {
    const width = Math.min(MAX_W, MAX_H * aspect)
    return { width, height: width / aspect }
  }
  const height = Math.min(MAX_H, MAX_W / aspect)
  return { width: height * aspect, height }
}

/** Kosár-sor: kis arányos lapforma (+ szögvágás); szálvonal csak szálirányos lapon. */
export function CartPanelThumb({
  grainMm,
  crossMm,
  machining,
  fillStyle,
  grainDirection = false,
  className
}: {
  grainMm: number
  crossMm: number
  machining: KioskMachining
  fillStyle: CSSProperties
  grainDirection?: boolean
  className?: string
}) {
  const size = useMemo(
    () => fitSize(grainMm, crossMm),
    [grainMm, crossMm]
  )

  const szogCorners: SzogCornerCut[] = useMemo(() => {
    const szog = machining.szog
    if (!szog) return []
    return [
      {
        corner: szog.corner,
        alongGrainMm: szog.alongGrainMm,
        alongCrossMm: szog.alongCrossMm
      }
    ]
  }, [machining.szog])

  const szogActive = szogCorners.length > 0

  const points = useMemo(() => {
    if (!szogActive) return []
    return szogvagasPolygonPoints(
      size.width,
      size.height,
      grainMm,
      crossMm,
      szogCorners
    )
  }, [szogActive, size, grainMm, crossMm, szogCorners])

  const clip = pointsToCssPolygon(points)
  const polygon = pointsToSvgPolygon(points)

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size.width, height: size.height }}
      aria-hidden
    >
      <div
        className={cn(
          'absolute inset-0 overflow-hidden',
          !szogActive && 'rounded-[3px] border border-ink/35'
        )}
        style={szogActive ? { background: '#e8eaed' } : fillStyle}
      >
        {szogActive && clip ? (
          <div
            className="absolute inset-0"
            style={{ ...fillStyle, clipPath: clip }}
          >
            {grainDirection ? <GrainLines /> : null}
          </div>
        ) : grainDirection ? (
          <GrainLines />
        ) : null}
      </div>

      {szogActive && polygon ? (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.width}
          height={size.height}
        >
          <polygon
            points={polygon}
            fill="none"
            stroke="#18181B"
            strokeWidth={1.5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  )
}

function GrainLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full opacity-[0.28]"
      aria-hidden
    >
      {Array.from({ length: 8 }, (_, i) => {
        const y = ((i + 1) / 9) * 100
        return (
          <line
            key={i}
            x1="8%"
            y1={`${y}%`}
            x2="92%"
            y2={`${y}%`}
            stroke="#18181B"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}
