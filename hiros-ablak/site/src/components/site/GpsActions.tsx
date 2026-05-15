"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

type Props = {
  latitude: number
  longitude: number
  googleMapsUrl: string
  wazeUrl: string
  appleMapsUrl: string
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

const rowBase =
  "group flex w-full min-h-[52px] items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[var(--color-brand)]/40 hover:bg-stone-50/80"

const mediaSlot =
  "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04] ring-1 ring-black/[0.06]"

const mediaSlotWide =
  "relative flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04] px-1 ring-1 ring-black/[0.06]"

export function GpsActions({
  latitude,
  longitude,
  googleMapsUrl,
  wazeUrl,
  appleMapsUrl,
}: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(id)
  }, [copied])

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(`${latitude}, ${longitude}`)
      setCopied(true)
    } catch {
      /* silent fallback */
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={onCopy} className={rowBase}>
        <span className={mediaSlot}>
          <IconCopy className="h-6 w-6 text-black/65" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black/90">
            {copied ? "Másolva" : "Koordináták másolása"}
          </span>
          <span className="mt-0.5 block text-xs text-black/55">
            {copied
              ? "A koordináták a vágólapon vannak."
              : "Egy koppintással a vágólapra."}
          </span>
        </span>
      </button>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noreferrer"
        className={rowBase}
      >
        <span className={mediaSlotWide}>
          <Image
            src="/img/Google_Maps_Logo_2020.svg.png"
            alt=""
            width={112}
            height={28}
            className="h-7 w-auto max-w-[4.5rem] object-contain"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black/90">
            Google Maps
          </span>
          <span className="mt-0.5 block text-xs text-black/55">
            Útvonal és hely megnyitása
          </span>
        </span>
        <IconChevron className="h-5 w-5 shrink-0 text-black/25 transition group-hover:text-[var(--color-brand)]" />
      </a>

      <a href={wazeUrl} target="_blank" rel="noreferrer" className={rowBase}>
        <span className={mediaSlot}>
          <Image
            src="/img/waze-icon-logo.png"
            alt=""
            width={48}
            height={48}
            className="h-8 w-8 object-contain"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black/90">
            Waze
          </span>
          <span className="mt-0.5 block text-xs text-black/55">
            Navigáció megnyitása
          </span>
        </span>
        <IconChevron className="h-5 w-5 shrink-0 text-black/25 transition group-hover:text-[var(--color-brand)]" />
      </a>

      <a
        href={appleMapsUrl}
        target="_blank"
        rel="noreferrer"
        className={rowBase}
      >
        <span className={mediaSlotWide}>
          <Image
            src="/img/apple-maps5287.jpg"
            alt=""
            width={96}
            height={32}
            className="h-7 w-auto max-w-[4.5rem] rounded-sm object-contain"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black/90">
            Apple Térkép
          </span>
          <span className="mt-0.5 block text-xs text-black/55">
            Megnyitás Apple készüléken
          </span>
        </span>
        <IconChevron className="h-5 w-5 shrink-0 text-black/25 transition group-hover:text-[var(--color-brand)]" />
      </a>
    </div>
  )
}
