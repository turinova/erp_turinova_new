"use client"

import { useState } from "react"

export type FaqItem = {
  q: string
  a: string
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="grid gap-3">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx
        return (
          <div
            key={item.q}
            className="rounded-2xl border border-black/10 bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-stone-50 transition"
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold tracking-tight text-slate-900">
                {item.q}
              </span>
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/8 text-[var(--color-brand)] transition-transform ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm text-black/70 leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
