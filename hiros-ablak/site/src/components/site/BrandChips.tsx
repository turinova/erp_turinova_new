import Link from "next/link"

export type BrandChipItem = {
  name: string
  href?: string
}

type BrandChipsProps = {
  items: readonly BrandChipItem[]
  linked?: boolean
  size?: "sm" | "md"
  className?: string
}

const sizeClasses = {
  sm: "px-3 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
} as const

const linkClasses =
  "inline-flex items-center rounded-full border border-black/10 bg-white font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-[var(--color-brand-contrast)] hover:shadow-[0_6px_14px_rgba(151,29,37,0.25)]"

const textClasses =
  "inline-flex items-center rounded-full border border-black/10 bg-white font-semibold text-slate-900"

const textMutedClasses =
  "inline-flex items-center rounded-full border border-black/10 bg-stone-50/60 font-medium text-black/80"

export function BrandChips({
  items,
  linked = true,
  size = "md",
  className = "",
}: BrandChipsProps) {
  if (items.length === 0) return null

  const pad = sizeClasses[size]

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {items.map((item) => {
        if (linked && item.href) {
          return (
            <Link key={item.name} href={item.href} className={`${linkClasses} ${pad}`}>
              {item.name}
            </Link>
          )
        }
        return (
          <span key={item.name} className={`${textClasses} ${pad}`}>
            {item.name}
          </span>
        )
      })}
    </div>
  )
}

type BrandChipGroupProps = {
  label: string
  items: readonly BrandChipItem[]
  linked?: boolean
  muted?: boolean
}

export function BrandChipGroup({
  label,
  items,
  linked = true,
  muted = false,
}: BrandChipGroupProps) {
  if (items.length === 0) return null

  const pad = sizeClasses.md
  const spanClass = muted ? textMutedClasses : textClasses

  return (
    <div>
      {label ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
          {label}
        </div>
      ) : null}
      <div className={label ? "mt-3 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
        {items.map((item) => {
          if (linked && item.href) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${linkClasses} ${pad}`}
              >
                {item.name}
              </Link>
            )
          }
          return (
            <span key={item.name} className={`${spanClass} ${pad}`}>
              {item.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}
