import { Camera } from 'lucide-react'
import Image from 'next/image'

import { BELEPOSZAMLALO_CAMERA } from '@/lib/marketing/beleposzamlalo'
import { LIVE_CLOCK_LABEL } from '@/lib/marketing/beleposzamlalo-demo-data'
import { cn } from '@/lib/utils'

/**
 * AI kamera média-slot.
 *
 * `src` nélkül termékszerű helyőrzőt mutat. Ha megadod:
 * - `.mp4` / `.webm` → néma, ismétlődő videó (ez a javasolt forma, kisebb),
 * - bármi más (pl. `.gif`) → kép, Next optimalizálás nélkül.
 */
export function AiCameraMediaSlot({
  src,
  poster,
  className
}: {
  src?: string
  poster?: string
  className?: string
}) {
  const isVideo = Boolean(src && /\.(mp4|webm)$/i.test(src))

  return (
    <figure className={cn('min-w-0', className)}>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-subtle">
        {src ? (
          isVideo ? (
            <video
              src={src}
              poster={poster}
              autoPlay
              muted
              loop
              playsInline
              className="size-full object-cover"
              aria-label={BELEPOSZAMLALO_CAMERA.body}
            />
          ) : (
            <Image
              src={src}
              alt={BELEPOSZAMLALO_CAMERA.body}
              fill
              unoptimized
              className="object-cover"
            />
          )
        ) : (
          <div className="absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong/60 px-4 text-center">
            <Camera
              className="size-6 text-ink-disabled"
              strokeWidth={1.75}
              aria-hidden
            />
            <p className="text-[12.5px] font-medium text-ink-secondary">
              {BELEPOSZAMLALO_CAMERA.placeholder}
            </p>
            <p className="text-[11px] text-ink-muted">
              A be- és kilépés irányának felismerése
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2.5">
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-ink-secondary backdrop-blur-sm">
            {BELEPOSZAMLALO_CAMERA.meta}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded border border-border bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-ink backdrop-blur-sm">
            <span
              className="size-1.5 rounded-full bg-danger"
              aria-hidden
            />
            Mintafelvétel
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-border bg-white px-2.5 py-1.5 text-[11px] text-ink-secondary">
          <span>Számlálás aktív · irányfelismerés a bejáratnál</span>
          <span className="tabular-nums">{LIVE_CLOCK_LABEL}</span>
        </div>
      </div>
      <figcaption className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">
        {BELEPOSZAMLALO_CAMERA.body}
      </figcaption>
    </figure>
  )
}
