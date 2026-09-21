"use client"

import { useEffect, useState } from "react"
import TelClickLink from "./TelClickLink"

type StickySurveyBarProps = {
  phoneDisplay: string
  phoneTel: string
  /** Hide while lightbox is open */
  hidden?: boolean
  /** Element id to observe — when out of view, show bar */
  formId?: string
}

/**
 * Shows when #felmeres leaves the viewport (mobile always after scroll;
 * desktop too so Ads users can jump back to form while browsing gallery).
 */
export default function StickySurveyBar({
  phoneDisplay,
  phoneTel,
  hidden = false,
  formId = "felmeres",
}: StickySurveyBarProps) {
  const [formInView, setFormInView] = useState(true)

  useEffect(() => {
    const el = document.getElementById(formId)
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        setFormInView(entry.isIntersecting && entry.intersectionRatio > 0.15)
      },
      { threshold: [0, 0.15, 0.4] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [formId])

  if (hidden || formInView) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl gap-2 px-3 py-2.5 sm:px-4">
        <TelClickLink
          href={phoneTel}
          location="sticky_bar"
          phoneDisplay={phoneDisplay}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-black/12 bg-white px-3 py-3 text-sm font-semibold text-slate-900"
        >
          {phoneDisplay}
        </TelClickLink>
        <a
          href={`#${formId}`}
          className="inline-flex flex-[1.5] items-center justify-center rounded-full bg-[var(--color-brand)] px-3 py-3 text-sm font-semibold text-white"
        >
          Kérem a felmérést
        </a>
      </div>
    </div>
  )
}
