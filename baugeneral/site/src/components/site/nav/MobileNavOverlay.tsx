"use client"

import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { NavChevron } from "@/components/site/nav/NavChevron"
import { LocaleSwitch } from "@/components/site/nav/LocaleSwitch"
import { ServiceIcon } from "@/components/site/nav/ServiceIcon"
import { HEADER_CTA, SERVICE_NAV_ITEMS } from "@/lib/nav-data"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

type MobileNavPanelProps = {
  open: boolean
  onClose: () => void
  locale?: "hu" | "en" | "de"
}

const HU_TOP_LINKS = [
  { href: "/futo-projektek", label: "Futó projektek" },
  { href: "/referenciak", label: "Referenciák" },
  { href: "/megjelenesek", label: "Megjelenések" },
  { href: "/kapcsolat", label: "Kapcsolat" },
] as const

const EN_TOP_LINKS = [
  { href: "/en", label: "Home" },
  { href: "/en/contact", label: "Contact" },
] as const

const DE_TOP_LINKS = [
  { href: "/de", label: "Start" },
  { href: "/de/contact", label: "Kontakt" },
] as const

const EN_SERVICE_LINKS = [
  {
    href: "/en/services/industrial-buildings",
    label: "Industrial buildings",
    icon: "industrial" as const,
    featured: true,
    previewImage: "/img/nav/ipari-epuletek.jpg",
    previewGradient:
      "linear-gradient(135deg, #A60C19 0%, #6D0811 50%, #1C1A18 100%)",
  },
] as const

const DE_SERVICE_LINKS = [
  {
    href: "/de/services/industrial-buildings",
    label: "Industriebauten",
    icon: "industrial" as const,
    featured: true,
    previewImage: "/img/nav/ipari-epuletek.jpg",
    previewGradient:
      "linear-gradient(135deg, #A60C19 0%, #6D0811 50%, #1C1A18 100%)",
  },
] as const

function isPlaceholderPreview(src: string) {
  return src.endsWith(".svg")
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <>
          <path d="M4 8h16M4 16h16" />
        </>
      )}
    </svg>
  )
}

function NavRow({
  href,
  label,
  onClose,
}: {
  href: string
  label: string
  onClose: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="nav-link mx-0 block w-full rounded-none border-b border-[var(--color-border)]/70 py-3.5 text-[16px] after:hidden"
    >
      {label}
    </Link>
  )
}

/** Slide-down panel anchored below header (not full-screen overlay). */
export function MobileNavPanel({ open, onClose, locale = "hu" }: MobileNavPanelProps) {
  const [servicesOpen, setServicesOpen] = useState(false)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!open) {
      setServicesOpen(false)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const topLinks =
    locale === "en" ? EN_TOP_LINKS : locale === "de" ? DE_TOP_LINKS : HU_TOP_LINKS
  const serviceLinks =
    locale === "en"
      ? EN_SERVICE_LINKS
      : locale === "de"
        ? DE_SERVICE_LINKS
        : SERVICE_NAV_ITEMS
  const featuredService = serviceLinks.find((s) => s.featured) ?? serviceLinks[0]

  return (
    <AnimatePresence>
      {open && (
        <>
          <button
            type="button"
            aria-label={locale === "hu" ? "Menü bezárása" : "Close menu"}
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={onClose}
          />
          <motion.nav
            className="panel-soft absolute inset-x-4 top-full z-50 mt-1 overflow-hidden md:hidden"
            aria-label={locale === "hu" ? "Mobil menü" : "Mobile menu"}
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="max-h-[min(70dvh,480px)] overflow-y-auto px-4 py-2">
              <div>
                <button
                  type="button"
                  aria-expanded={servicesOpen}
                  onClick={() => setServicesOpen((v) => !v)}
                  className={`nav-link mx-0 w-full justify-between rounded-none border-b border-[var(--color-border)]/70 py-3.5 text-[16px] ${
                    servicesOpen ? "nav-link--active" : ""
                  }`}
                >
                  {locale === "en"
                    ? "Services"
                    : locale === "de"
                      ? "Leistungen"
                      : "Szolgáltatások"}
                  <NavChevron open={servicesOpen} />
                </button>

                {servicesOpen && (
                  <div className="border-b border-[var(--color-border)]/70 pb-2">
                    <div className="preview-card relative mx-1 mb-2 mt-2 h-40 w-[calc(100%-0.5rem)]">
                      {isPlaceholderPreview(featuredService.previewImage) ? (
                        <>
                          <div
                            className="preview-card__gradient"
                            style={{ background: featuredService.previewGradient }}
                            aria-hidden
                          />
                          <Image
                            src={featuredService.previewImage}
                            alt=""
                            fill
                            className="object-cover mix-blend-multiply opacity-90"
                            sizes="100vw"
                            aria-hidden
                          />
                          <div className="preview-card__overlay" aria-hidden />
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={featuredService.previewImage}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          aria-hidden
                        />
                      )}
                    </div>
                    {serviceLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`nav-dropdown-link py-2.5 pl-5 text-[15px] ${
                          item.featured ? "nav-dropdown-link--featured" : ""
                        }`}
                      >
                        <ServiceIcon icon={item.icon} className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {topLinks.map((link) => (
                <NavRow
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  onClose={onClose}
                />
              ))}
            </div>

            <div className="border-t border-[var(--color-border)]/70 bg-[var(--color-surface-soft)] px-4 py-3">
              <div className="mb-3 flex justify-center">
                <LocaleSwitch locale={locale} />
              </div>
              <Link
                href={locale === "en" ? "/en/contact" : locale === "de" ? "/de/contact" : HEADER_CTA.href}
                onClick={onClose}
                className="header-cta flex w-full items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-semibold"
              >
                {locale === "hu" ? HEADER_CTA.label : locale === "de" ? HEADER_CTA.labelDe : HEADER_CTA.labelEn}
                <span aria-hidden className="text-white/80">
                  →
                </span>
              </Link>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}

/** @deprecated Use MobileNavPanel — kept for export compatibility */
export function MobileNavOverlay(props: MobileNavPanelProps) {
  return <MobileNavPanel {...props} />
}

export { MenuIcon }
