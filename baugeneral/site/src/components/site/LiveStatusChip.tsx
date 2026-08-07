import Link from "next/link"
import { HEADER_STATUS } from "@/lib/nav-data"

type LiveStatusChipProps = {
  className?: string
  label?: string
  href?: string
}

export function LiveStatusChip({
  className = "",
  label,
  href = HEADER_STATUS.href,
}: LiveStatusChipProps) {
  return (
    <Link href={href} className={`status-chip ${className}`}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-live)] opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-live)]" />
      </span>
      {label ?? HEADER_STATUS.label}
    </Link>
  )
}
