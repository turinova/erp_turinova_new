"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useCookieConsent } from "./CookieConsentProvider"

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="text-sm text-black/80">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-black/15 transition peer-checked:bg-[var(--color-brand)] peer-disabled:opacity-60"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}

export function CookieBanner() {
  const {
    hasDecided,
    settingsOpen,
    consent,
    acceptAll,
    rejectOptional,
    savePreferences,
    openSettings,
    closeSettings,
  } = useCookieConsent()

  const [statistics, setStatistics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (settingsOpen) {
      setStatistics(consent?.statistics ?? false)
      setMarketing(consent?.marketing ?? false)
    }
  }, [settingsOpen, consent])

  const visible = !hasDecided || settingsOpen
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-4 shadow-[0_16px_48px_rgba(0,0,0,0.18)] sm:p-5">
        <h2
          id="cookie-banner-title"
          className="text-base font-semibold tracking-tight text-slate-900"
        >
          Sütik és adatvédelem
        </h2>
        <p className="mt-2 text-sm text-black/70 leading-relaxed">
          Weboldalunk a működéshez szükséges sütiket használ. Statisztikai és
          marketing célú sütiket (például külső vélemény-widget) csak az Ön
          hozzájárulásával helyezünk el. A választását bármikor módosíthatja.
        </p>
        <p className="mt-2 text-xs text-black/55">
          <Link
            href="/cookie-tajekoztato"
            className="font-medium text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90"
          >
            Cookie tájékoztató
          </Link>
          {" · "}
          <Link
            href="/adatkezelesi-tajekoztato"
            className="font-medium text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90"
          >
            Adatkezelési tájékoztató
          </Link>
        </p>

        {settingsOpen && (
          <div className="mt-4 rounded-xl border border-black/10 bg-stone-50/80 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
              Süti kategóriák
            </p>
            <div className="mt-2 divide-y divide-black/10">
              <Toggle
                label="Szükséges (mindig aktív)"
                checked
                disabled
                onChange={() => {}}
              />
              <Toggle
                label="Statisztika"
                checked={statistics}
                onChange={setStatistics}
              />
              <Toggle
                label="Marketing / külső tartalom (vélemények)"
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={rejectOptional}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/80 hover:border-black/25"
          >
            Csak szükséges
          </button>
          {!settingsOpen ? (
            <button
              type="button"
              onClick={openSettings}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/80 hover:border-black/25"
            >
              Beállítások
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={closeSettings}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/80 hover:border-black/25"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => savePreferences(statistics, marketing)}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--color-brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
              >
                Mentés
              </button>
            </>
          )}
          <button
            type="button"
            onClick={acceptAll}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          >
            Elfogadom mind
          </button>
        </div>
      </div>
    </div>
  )
}

/** Re-open cookie settings from footer or widgets */
export function CookieSettingsLink({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { openSettings } = useCookieConsent()
  return (
    <button type="button" onClick={openSettings} className={className}>
      {children ?? "Süti beállítások"}
    </button>
  )
}
