"use client"

import { useEffect, useState } from "react"

export function CopyToClipboardButton({
  text,
  className,
  label = "Cím másolása",
}: {
  text: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(id)
  }, [copied])

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Fallback: do nothing (still accessible via manual select)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className}
      aria-label={label}
    >
      {copied ? "Másolva" : label}
    </button>
  )
}

