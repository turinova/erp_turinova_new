"use client"

import {
  REFERENCE_TYPE_LABELS,
  REFERENCE_TYPE_ORDER,
  type ReferenceType,
} from "@/lib/references"

type ReferencesFilterProps = {
  activeType: ReferenceType | null
  counts: Record<ReferenceType, number>
  totalCount: number
  onChange: (type: ReferenceType | null) => void
}

export function ReferencesFilter({
  activeType,
  counts,
  totalCount,
  onChange,
}: ReferencesFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Referencia típus szűrő"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin"
    >
      <FilterChip
        label="Összes"
        count={totalCount}
        active={activeType === null}
        onClick={() => onChange(null)}
      />
      {REFERENCE_TYPE_ORDER.map((type) => (
        <FilterChip
          key={type}
          label={REFERENCE_TYPE_LABELS[type]}
          count={counts[type]}
          active={activeType === type}
          onClick={() => onChange(type)}
        />
      ))}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
          : "border-black/10 bg-white/80 text-black/70 hover:border-black/20 hover:bg-white",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "tabular-nums text-xs",
          active ? "text-white/80" : "text-black/40",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  )
}
