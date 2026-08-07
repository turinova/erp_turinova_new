import type { ReactNode } from "react"

type ServiceBandProps = {
  tone: "white" | "stone"
  children: ReactNode
  className?: string
}

export function ServiceBand({ tone, children, className = "" }: ServiceBandProps) {
  return (
    <div
      className={
        tone === "white"
          ? `bg-white py-12 md:py-16 ${className}`
          : `bg-stone-wash py-12 md:py-16 ${className}`
      }
    >
      {children}
    </div>
  )
}
