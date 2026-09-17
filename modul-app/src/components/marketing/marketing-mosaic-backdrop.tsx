import { SquaresMosaic } from '@/components/auth/squares-mosaic'

/**
 * Marketing hero backdrop — soft idle mosaic + strong white overlay so hero pops.
 */
export function MarketingMosaicBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[100dvh] w-full overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0">
        <SquaresMosaic
          squareSize={40}
          borderColor="#a1a1aa"
          enableHover={false}
          respectReducedMotion={false}
          idleIntervalMs={1600}
          idleBrightnessBoost={0}
          idleMaxBrightness={55}
          idleStep={0.55}
          maxAnimatingTiles={10}
        />
      </div>
      {/* Mid wash — mosaic readable, hero still pops */}
      <div className="absolute inset-0 bg-white/40" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 28%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.2) 55%, transparent 75%)'
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/70 to-transparent" />
    </div>
  )
}
