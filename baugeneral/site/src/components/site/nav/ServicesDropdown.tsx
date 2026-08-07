"use client"

import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useId, useState } from "react"
import { ServiceIcon } from "@/components/site/nav/ServiceIcon"
import {
  SERVICE_NAV_ITEMS,
  type ServiceNavChild,
} from "@/lib/nav-data"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

type ServicesDropdownProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefer right edge when nav pill sits on the right */
  align?: "left" | "right"
}

function isPlaceholderPreview(src: string) {
  return src.endsWith(".svg")
}

function ServicePreview({ service }: { service: ServiceNavChild }) {
  const placeholder = isPlaceholderPreview(service.previewImage)
  return (
    <div className="preview-card h-full min-h-[280px] w-full">
      {placeholder ? (
        <>
          <div
            className="preview-card__gradient"
            style={{ background: service.previewGradient }}
            aria-hidden
          />
          <Image
            src={service.previewImage}
            alt=""
            fill
            className="object-cover mix-blend-multiply opacity-90"
            sizes="400px"
            aria-hidden
          />
          <div className="preview-card__overlay" aria-hidden />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={service.previewImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}
      <div className="preview-card__caption">
        <p className="font-display text-[14px] font-semibold leading-tight text-white">
          {service.label}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/90">
          {service.description}
        </p>
      </div>
    </div>
  )
}

export function ServicesDropdown({
  open,
  onOpenChange,
  align = "left",
}: ServicesDropdownProps) {
  const menuId = useId()
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState<ServiceNavChild>(SERVICE_NAV_ITEMS[0])
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={menuId}
          role="menu"
          aria-label="Szolgáltatások"
          className={`services-dropdown-panel panel-soft absolute top-full z-50 flex w-[min(100vw-2rem,780px)] max-w-[calc(100vw-2rem)] items-stretch overflow-hidden p-1 ${
            align === "right" ? "right-0 left-auto" : "left-0"
          }`}
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: reduced ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <ul className="min-w-0 flex-1 py-1.5">
            {SERVICE_NAV_ITEMS.map((item) => {
              const isActive = active.href === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={close}
                    onMouseEnter={() => setActive(item)}
                    onFocus={() => setActive(item)}
                    className={`nav-dropdown-link ${
                      isActive ? "nav-dropdown-link--active" : ""
                    } ${item.featured ? "nav-dropdown-link--featured" : ""}`}
                  >
                    <ServiceIcon icon={item.icon} className="h-4 w-4 text-[var(--color-muted)]" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="hidden w-[400px] shrink-0 self-stretch py-1 sm:block">
            <ServicePreview service={active} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
