"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import {
  getOpeningHoursScheduleLines,
  getOpeningStatus,
} from "@/lib/opening-hours"

export function OpeningHoursPill() {
  const shouldReduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [, forceRender] = useState(0)

  // Update status every minute (keeps “Nyitva most” accurate)
  useEffect(() => {
    const id = window.setInterval(() => forceRender((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // `tick` exists purely to re-render periodically; computing status on render is fine.
  const status = getOpeningStatus()
  const schedule = getOpeningHoursScheduleLines()

  const dotClass = status.isOpen ? "bg-emerald-500" : "bg-rose-500"
  const mainText = status.isOpen
    ? `${status.label} · ${status.closesAt}-ig`
    : `${status.label} · Nyit: ${status.nextOpen}`

  const dur = shouldReduceMotion ? 0 : 0.16

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black/70 hover:border-[var(--color-brand)] hover:text-black"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span>{mainText}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
            transition={{ duration: dur, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-black/10 bg-white p-3 shadow-sm"
            role="dialog"
            aria-label="Nyitvatartás"
          >
            <div className="text-[11px] font-semibold tracking-wide text-black/60">
              Nyitvatartás
            </div>
            <dl className="mt-2 grid gap-1 text-sm">
              {schedule.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between">
                  <dt className="text-black/60">{row.label}</dt>
                  <dd className="font-medium text-black/80">{row.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

