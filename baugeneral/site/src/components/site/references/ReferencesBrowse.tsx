"use client"

import Link from "next/link"
import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ReferencesFilter } from "@/components/site/references/ReferencesFilter"
import { ReferencesVisualGrid } from "@/components/site/references/ReferencesVisualGrid"
import {
  REFERENCE_TYPE_ORDER,
  isReferenceType,
  type Reference,
  type ReferenceType,
} from "@/lib/references"

type ReferencesBrowseProps = {
  references: Reference[]
}

export function ReferencesBrowse({ references }: ReferencesBrowseProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawType = searchParams.get("type")
  const activeType: ReferenceType | null =
    rawType && isReferenceType(rawType) ? rawType : null

  const counts = useMemo(() => {
    const next = Object.fromEntries(
      REFERENCE_TYPE_ORDER.map((t) => [t, 0]),
    ) as Record<ReferenceType, number>
    for (const r of references) next[r.type] += 1
    return next
  }, [references])

  const filtered = useMemo(
    () =>
      activeType
        ? references.filter((r) => r.type === activeType)
        : references,
    [activeType, references],
  )

  const setType = useCallback(
    (type: ReferenceType | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (type) params.set("type", type)
      else params.delete("type")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div>
      <ReferencesFilter
        activeType={activeType}
        counts={counts}
        totalCount={references.length}
        onChange={setType}
      />

      <div className="mt-5">
        {filtered.length > 0 ? (
          <ReferencesVisualGrid references={filtered} />
        ) : (
          <div className="rounded-[var(--radius-md)] border border-black/8 bg-white/70 px-5 py-10 text-center">
            <p className="text-sm text-black/60">
              Ehhez a típushoz még nincs publikált referencia.
            </p>
            <button
              type="button"
              onClick={() => setType(null)}
              className="mt-3 cursor-pointer text-sm font-semibold text-[var(--color-brand)] hover:underline"
            >
              Összes mutatása
            </button>
          </div>
        )}
      </div>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-black/8 bg-white px-5 py-7 md:px-8 md:py-8">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] md:text-2xl">
          Hasonló projektje van?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/60 md:text-[0.9375rem]">
          Írjon nekünk — hamarosan emailben jelentkezünk, és átbeszéljük a
          műszaki keretet.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/kapcsolat"
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-hover)]"
          >
            Beszéljünk a projektjéről
          </Link>
          <Link
            href="/futo-projektek"
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-black/12 bg-white px-5 py-2.5 text-sm font-semibold text-black/75 transition-colors hover:border-black/20 hover:bg-stone-50"
          >
            Futó projektek
          </Link>
        </div>
      </div>
    </div>
  )
}
