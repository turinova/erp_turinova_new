"use client"

import { ReferenceVisualCard } from "@/components/site/references/ReferenceVisualCard"
import type { Reference } from "@/lib/references"

type ReferencesVisualGridProps = {
  references: Reference[]
}

export function ReferencesVisualGrid({ references }: ReferencesVisualGridProps) {
  if (references.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {references.map((reference, index) => (
        <ReferenceVisualCard
          key={reference.slug}
          reference={reference}
          size={reference.featured ? "featured" : "standard"}
          entranceIndex={index}
        />
      ))}
    </div>
  )
}
