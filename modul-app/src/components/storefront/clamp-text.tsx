'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/** Hosszú szöveg 3 soros előnézettel és jól látható „Tovább” gombbal. */
export function ClampText({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={className}>
      <div ref={ref} className={cn(!expanded && 'line-clamp-3')}>
        {children}
      </div>
      {overflowing || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-[14px] font-medium text-ink underline underline-offset-2"
        >
          {expanded ? 'Kevesebb' : 'Tovább olvasom'}
        </button>
      ) : null}
    </div>
  )
}
