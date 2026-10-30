'use client'

import { Layers } from 'lucide-react'

import { cn } from '@/lib/utils'

type ListMaterialThumbProps = {
  name: string
  imageUrl: string | null
  /** Szálirány-vonalak az előnézeten. */
  showGrainHint?: boolean
  onPreview?: () => void
}

/** Lista thumbnail — kattintás a preview dialógusra (forgatás ott). */
export function ListMaterialThumb({
  name,
  imageUrl,
  showGrainHint = false,
  onPreview
}: ListMaterialThumbProps) {
  if (!imageUrl) {
    return (
      <span
        className="flex size-12 items-center justify-center rounded-md border border-dashed border-border text-ink-muted"
        aria-hidden
      >
        <Layers className="size-5" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onPreview}
      disabled={!onPreview}
      className={cn(
        'relative block rounded-md border border-border p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        !onPreview && 'cursor-default'
      )}
      aria-label={`${name} képének megnyitása`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="size-12 rounded-[5px] object-cover"
      />
      {showGrainHint ? (
        <span
          className="pointer-events-none absolute inset-0 flex flex-col justify-evenly rounded-[5px] px-1 py-1"
          aria-hidden
        >
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="h-px w-full shrink-0 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            />
          ))}
        </span>
      ) : null}
    </button>
  )
}
