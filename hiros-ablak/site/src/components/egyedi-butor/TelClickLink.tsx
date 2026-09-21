"use client"

import { analyticsEvent } from "@/lib/analytics"

/** Telefon link Ads / GA4 méréssel. */
export default function TelClickLink({
  href,
  location,
  phoneDisplay,
  className,
  children,
}: {
  href: string
  location: string
  phoneDisplay: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() =>
        analyticsEvent("tel_click", { location, phone: phoneDisplay })
      }
    >
      {children}
    </a>
  )
}
