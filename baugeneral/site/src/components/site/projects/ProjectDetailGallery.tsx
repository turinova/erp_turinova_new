"use client"

import { useState } from "react"
import {
  GalleryZoomHint,
  ReferenceImageLightbox,
} from "@/components/site/references/ReferenceImageLightbox"
import type { ProjectImage } from "@/lib/projects"

type ProjectDetailGalleryProps = {
  images: ProjectImage[]
}

type GalleryImageButtonProps = {
  image: ProjectImage
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
      aria-label={`${image.alt}: nagyítás`}
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

export function ProjectDetailGallery({ images }: ProjectDetailGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  const [primary, ...secondary] = images

  return (
    <>
      <section aria-label="Projekt képek" className="grid gap-2.5 md:grid-cols-12">
        <div className="relative h-[280px] overflow-hidden rounded-[var(--radius-md)] md:col-span-8 md:h-[420px]">
          <GalleryImageButton
            image={primary}
            index={0}
            onOpen={setLightboxIndex}
            className="absolute inset-0 h-full w-full rounded-[var(--radius-md)]"
          />
        </div>

        {secondary.length > 0 ? (
          <div className="flex flex-col gap-2.5 md:col-span-4 md:h-[420px]">
            {secondary.slice(0, 2).map((image, index) => (
              <GalleryImageButton
                key={`side-${index}`}
                image={image}
                index={index + 1}
                onOpen={setLightboxIndex}
                className="h-[170px] rounded-[var(--radius-md)] md:h-[205px] md:flex-1"
              />
            ))}
          </div>
        ) : null}

        {secondary.length > 2 ? (
          <div className="grid grid-cols-2 gap-2.5 md:col-span-12 md:grid-cols-4">
            {secondary.slice(2).map((image, index) => (
              <GalleryImageButton
                key={`grid-${index}`}
                image={image}
                index={index + 3}
                onOpen={setLightboxIndex}
                className="h-[150px] rounded-[var(--radius-md)] md:h-[170px]"
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
