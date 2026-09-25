'use client'

import { Play } from 'lucide-react'
import { useState } from 'react'

import { youtubeEmbedUrl, youtubeIdOf, youtubeThumbnailUrl } from '@/lib/storefront/youtube'

/** Kattintásig nem tölt YouTube lejátszót (sebesség, adatvédelem). */
export function PdpVideo({ url, title }: { url: string; title: string }) {
  const [play, setPlay] = useState(false)
  const id = youtubeIdOf(url)
  if (!id) return null

  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-stone-900">
      {play ? (
        <iframe
          src={youtubeEmbedUrl(id, true)}
          title={`${title} — videó`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          className="size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          className="group relative flex size-full cursor-pointer flex-col items-center justify-center gap-2 text-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumbnailUrl(id)}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-70"
          />
          <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-white text-ink">
            <Play className="ml-0.5 size-6 fill-current" aria-hidden />
          </span>
          <span className="relative text-[14px] font-medium">Videó lejátszása</span>
        </button>
      )}
    </div>
  )
}
