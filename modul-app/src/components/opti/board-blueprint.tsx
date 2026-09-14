'use client'

import type { Placement } from '@/lib/opti/optimization-types'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'

/** Notion-inspired area → fill (main-app Opti parity). */
function panelFill(w: number, h: number): string {
  const area = w * h
  if (area >= 1_000_000) return '#f1f3f4'
  if (area >= 500_000) return '#e8f0fe'
  if (area >= 250_000) return '#e6f4ea'
  if (area >= 100_000) return '#fef7e0'
  return '#fce7f3'
}

const TRIM_HATCH =
  'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158,158,158,0.2) 2px, rgba(158,158,158,0.2) 4px)'

type BoardBlueprintProps = {
  boardWidth: number
  boardHeight: number
  placements: Placement[]
  material: OptiSheetMaterialOption | null
}

/**
 * Absolute-% blueprint board (main-app Opti accordion viz — CSS, not SVG).
 * Coordinates use API `debug` swapped board axes.
 */
export function BoardBlueprint({
  boardWidth,
  boardHeight,
  placements,
  material
}: BoardBlueprintProps) {
  const bw = Math.max(boardWidth, 1)
  const bh = Math.max(boardHeight, 1)
  const kerf = material?.kerf_mm || 3
  const trimTop = material?.trim_top_mm ?? 0
  const trimBottom = material?.trim_bottom_mm ?? 0
  const trimLeft = material?.trim_left_mm ?? 0
  const trimRight = material?.trim_right_mm ?? 0
  const grain = Boolean(material?.grain_direction)

  return (
    <div className="mx-auto w-full max-w-[700px] bg-white p-3 font-mono">
      <div
        className="relative w-full overflow-hidden border border-ink bg-[#f0f8ff]"
        style={{ aspectRatio: `${bw} / ${bh}` }}
        aria-label="Tábla elrendezés"
      >
        {trimTop > 0 ? (
          <div
            className="pointer-events-none absolute left-0 top-0 z-[2] w-full border border-dashed border-black/20 bg-black/[0.04]"
            style={{
              height: `${(trimTop / bh) * 100}%`,
              backgroundImage: TRIM_HATCH
            }}
          />
        ) : null}
        {trimBottom > 0 ? (
          <div
            className="pointer-events-none absolute left-0 z-[2] w-full border border-dashed border-black/20 bg-black/[0.04]"
            style={{
              top: `${((bh - trimBottom) / bh) * 100}%`,
              height: `${(trimBottom / bh) * 100}%`,
              backgroundImage: TRIM_HATCH
            }}
          />
        ) : null}
        {trimLeft > 0 ? (
          <div
            className="pointer-events-none absolute left-0 top-0 z-[2] h-full border border-dashed border-black/20 bg-black/[0.04]"
            style={{
              width: `${(trimLeft / bw) * 100}%`,
              backgroundImage: TRIM_HATCH
            }}
          />
        ) : null}
        {trimRight > 0 ? (
          <div
            className="pointer-events-none absolute top-0 z-[2] h-full border border-dashed border-black/20 bg-black/[0.04]"
            style={{
              left: `${((bw - trimRight) / bw) * 100}%`,
              width: `${(trimRight / bw) * 100}%`,
              backgroundImage: TRIM_HATCH
            }}
          />
        ) : null}

        {placements.map((placement) => (
          <div
            key={placement.id}
            className="absolute flex items-center justify-center border border-ink"
            style={{
              left: `${(placement.x_mm / bw) * 100}%`,
              top: `${(placement.y_mm / bh) * 100}%`,
              width: `${(placement.w_mm / bw) * 100}%`,
              height: `${(placement.h_mm / bh) * 100}%`,
              backgroundColor: panelFill(placement.w_mm, placement.h_mm)
            }}
            title={`${placement.id}: ${placement.w_mm}×${placement.h_mm}`}
          >
            {grain
              ? Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={`grain-${placement.id}-${i}`}
                    className="pointer-events-none absolute left-[5%] right-[5%] z-[1] h-0.5 rounded-sm bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                    style={{ top: `${(i + 1) * 11}%` }}
                  />
                ))
              : null}
            <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-normal leading-none text-ink">
              {placement.w_mm}
            </span>
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-normal leading-none text-ink"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {placement.h_mm}
            </span>
          </div>
        ))}

        {placements.map((placement, index) => (
          <KerfRing
            key={`kerf-${placement.id}-${index}`}
            placement={placement}
            boardWidth={bw}
            boardHeight={bh}
            kerf={kerf}
          />
        ))}
      </div>
    </div>
  )
}

function KerfRing({
  placement,
  boardWidth,
  boardHeight,
  kerf
}: {
  placement: Placement
  boardWidth: number
  boardHeight: number
  kerf: number
}) {
  const half = kerf / 2
  const base =
    'pointer-events-none absolute z-10 bg-[#ff6b6b] opacity-70'

  return (
    <>
      <div
        className={base}
        style={{
          left: `${(placement.x_mm / boardWidth) * 100}%`,
          top: `${((placement.y_mm - half) / boardHeight) * 100}%`,
          width: `${(placement.w_mm / boardWidth) * 100}%`,
          height: `${(kerf / boardHeight) * 100}%`
        }}
      />
      <div
        className={base}
        style={{
          left: `${(placement.x_mm / boardWidth) * 100}%`,
          top: `${((placement.y_mm + placement.h_mm - half) / boardHeight) * 100}%`,
          width: `${(placement.w_mm / boardWidth) * 100}%`,
          height: `${(kerf / boardHeight) * 100}%`
        }}
      />
      <div
        className={base}
        style={{
          left: `${((placement.x_mm - half) / boardWidth) * 100}%`,
          top: `${(placement.y_mm / boardHeight) * 100}%`,
          width: `${(kerf / boardWidth) * 100}%`,
          height: `${(placement.h_mm / boardHeight) * 100}%`
        }}
      />
      <div
        className={base}
        style={{
          left: `${((placement.x_mm + placement.w_mm - half) / boardWidth) * 100}%`,
          top: `${(placement.y_mm / boardHeight) * 100}%`,
          width: `${(kerf / boardWidth) * 100}%`,
          height: `${(placement.h_mm / boardHeight) * 100}%`
        }}
      />
    </>
  )
}
