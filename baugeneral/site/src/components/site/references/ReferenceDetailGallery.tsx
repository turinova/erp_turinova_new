"use client"

import { useState } from "react"
import { ReferenceTypeChip } from "@/components/site/references/ReferenceTypeChip"
import {
  GalleryZoomHint,
  ReferenceImageLightbox,
} from "@/components/site/references/ReferenceImageLightbox"
import type { Reference, ReferenceImage } from "@/lib/references"

type ReferenceDetailGalleryProps = {
  reference: Reference
  images: ReferenceImage[]
}

type GalleryImageButtonProps = {
  image: ReferenceImage
  index: number
  onOpen: (index: number) => void
  className: string
}

function GalleryImageButton({ image, index, onOpen, className }: GalleryImageButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative cursor-zoom-in overflow-hidden bg-stone-300 ${className}`}
      aria-label={`${image.alt} — nagyítás`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
      />
      <GalleryZoomHint />
    </button>
  )
}

export function ReferenceDetailGallery({ reference, images }: ReferenceDetailGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  const [primary, ...secondary] = images

  return (
    <>
      <section aria-label="Projekt képek" className="grid gap-2 md:grid-cols-12">
        <div className="relative h-[260px] overflow-hidden rounded-[var(--radius-md)] md:col-span-8 md:h-[400px]">
          <GalleryImageButton
            image={primary}
            index={0}
            onOpen={setLightboxIndex}
            className="absolute inset-0 h-full w-full rounded-[var(--radius-md)]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 md:p-5">
            <ReferenceTypeChip type={reference.type} onImage />
            <h1 className="mt-2 text-lg font-semibold leading-snug text-white md:text-2xl">
              {reference.title}
            </h1>
          </div>
        </div>

        {secondary.length > 0 ? (
          <div className="flex flex-col gap-2 md:col-span-4 md:h-[400px]">
            {secondary.slice(0, 2).map((image, index) => (
              <GalleryImageButton
                key={`side-${index}`}
                image={image}
                index={index + 1}
                onOpen={setLightboxIndex}
                className="h-[160px] rounded-[var(--radius-md)] md:h-[196px] md:flex-1"
              />
            ))}
          </div>
        ) : null}

        {secondary.length > 2 ? (
          <div className="grid grid-cols-2 gap-2 md:col-span-12 md:grid-cols-4">
            {secondary.slice(2).map((image, index) => (
              <GalleryImageButton
                key={`grid-${index}`}
                image={image}
                index={index + 3}
                onOpen={setLightboxIndex}
                className="h-[140px] rounded-[var(--radius-md)] md:h-[160px]"
              />
            ))}
          </div>
        ) : null}
      </section>

      <ReferenceImageLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  )
}
