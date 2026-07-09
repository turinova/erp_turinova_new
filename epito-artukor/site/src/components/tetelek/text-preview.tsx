"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function TextPreview({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open ? (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 max-w-md rounded-md border bg-white p-3 text-sm shadow-lg",
            "pointer-events-none"
          )}
          role="tooltip"
        >
          <p className="leading-relaxed text-slate-700">{text}</p>
        </div>
      ) : null}
    </div>
  )
}
