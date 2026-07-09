"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { formatHuf } from "@/lib/pricing"
import { cn } from "@/lib/utils"

type InlinePriceCellProps = {
  value: number
  onCommit: (value: number) => void
  className?: string
}

export function InlinePriceCell({ value, onCommit, className }: InlinePriceCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = () => {
    const num = Number(draft.replace(/\s/g, ""))
    if (!Number.isNaN(num) && num >= 0 && num !== value) {
      onCommit(num)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setDraft(String(value))
            setEditing(false)
          }
        }}
        className={cn("h-8 w-28 text-right text-sm", className)}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded px-1 py-0.5 text-right hover:bg-amber-50 hover:ring-1 hover:ring-amber-200",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title="Dupla kattintás helyett kattints a szerkesztéshez"
    >
      {formatHuf(value)}
    </button>
  )
}
