"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app error]", error)
  }, [error])

  return (
    <div className="bg-stone-wash">
      <div className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          Hiba
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          Valami elromlott
        </h1>
        <p className="mt-4 text-base leading-relaxed text-black/65">
          Az oldal betöltése közben hiba történt. Próbálja újra, vagy térjen
          vissza a főoldalra.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold"
          >
            Újrapróbálás
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-black/12 bg-white px-5 py-2.5 text-sm font-semibold text-black/80"
          >
            Főoldal
          </Link>
          <Link
            href="/kapcsolat"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-black/12 bg-white px-5 py-2.5 text-sm font-semibold text-black/80"
          >
            Kapcsolat
          </Link>
        </div>
      </div>
    </div>
  )
}
