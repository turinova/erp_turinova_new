import type { ServiceIconKey } from "@/lib/nav-data"

const paths: Record<ServiceIconKey, React.ReactNode> = {
  industrial: (
    <>
      <path d="M3 14h18M5 14V8l7-4 7 4v6" />
      <path d="M8 14v4M16 14v4" />
    </>
  ),
  condo: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="1" />
      <path d="M8 10h2M14 10h2M8 14h2M14 14h2" />
    </>
  ),
  house: (
    <>
      <path d="M12 4L4 11v9h16V11L12 4z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  public: (
    <>
      <path d="M4 20h16M6 20V10l10-6v16" />
      <path d="M10 14h4M10 17h4" />
    </>
  ),
  reno: (
    <>
      <path d="M14 4l6 6-9 9H5v-6l9-9z" />
      <path d="M12 8l4 4" />
    </>
  ),
  trades: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.4-2.4 2.3-2.5z" />
    </>
  ),
  carpentry: (
    <>
      <path d="M3 17l9-9 4 4-9 9H3v-4z" />
      <path d="M15 5l2-2 4 4-2 2" />
      <path d="M7 13l4 4" />
    </>
  ),
}

export function ServiceIcon({
  icon,
  className = "h-4 w-4 text-black/40",
}: {
  icon: ServiceIconKey
  className?: string
}) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[icon]}
    </svg>
  )
}
