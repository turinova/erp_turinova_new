type NavChevronProps = {
  open?: boolean
  className?: string
}

export function NavChevron({ open = false, className = "" }: NavChevronProps) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""} ${className}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  )
}
