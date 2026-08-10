"use client"

import { ReferenceVisualCard, type ReferenceCardSize } from "@/components/site/references/ReferenceVisualCard"
import type { Reference } from "@/lib/references"

type ReferencesVisualGridProps = {
  references: Reference[]
}

/** 5-ös ritmus: nagy+kicsi sor, majd három egyforma; páratlan ciklusban a nagy jobbra. */
export function getReferenceCardSize(index: number): ReferenceCardSize {
  const cycle = Math.floor(index / 5)
  const i = index % 5
  const flip = cycle % 2 === 1
  if (i === 0) return flip ? "standard" : "wide"
  if (i === 1) return flip ? "wide" : "standard"
  return "standard"
}

export function ReferencesVisualGrid({ references }: ReferencesVisualGridProps) {
  if (references.length === 0) return null

  return (
    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {references.map((reference, index) => (
        <ReferenceVisualCard
          key={reference.slug}
          reference={reference}
          size={getReferenceCardSize(index)}
          entranceIndex={index}
        />
      ))}
    </div>
  )
}
