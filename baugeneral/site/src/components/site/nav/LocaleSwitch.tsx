import Link from "next/link"
import { LOCALE_SWITCH } from "@/lib/nav-data"

type LocaleSwitchProps = {
  locale: "hu" | "en" | "de"
  className?: string
}

export function LocaleSwitch({ locale, className = "" }: LocaleSwitchProps) {
  return (
    <div
      className={`locale-switch inline-flex items-center gap-2 ${className}`}
      role="group"
      aria-label={locale === "hu" ? "Nyelv" : "Language"}
    >
      <Link
        href={LOCALE_SWITCH.hu.href}
        hrefLang="hu"
        className={`locale-switch__item ${locale === "hu" ? "locale-switch__item--active" : ""}`}
        aria-current={locale === "hu" ? "page" : undefined}
      >
        {LOCALE_SWITCH.hu.label}
      </Link>
      <span className="text-[10px] text-[var(--color-border)]" aria-hidden>
        /
      </span>
      <Link
        href={LOCALE_SWITCH.en.href}
        hrefLang="en"
        className={`locale-switch__item ${locale === "en" ? "locale-switch__item--active" : ""}`}
        aria-current={locale === "en" ? "page" : undefined}
      >
        {LOCALE_SWITCH.en.label}
      </Link>
      <span className="text-[10px] text-[var(--color-border)]" aria-hidden>
        /
      </span>
      <Link
        href={LOCALE_SWITCH.de.href}
        hrefLang="de"
        className={`locale-switch__item ${locale === "de" ? "locale-switch__item--active" : ""}`}
        aria-current={locale === "de" ? "page" : undefined}
      >
        {LOCALE_SWITCH.de.label}
      </Link>
    </div>
  )
}
