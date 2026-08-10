import Link from "next/link"
import { ReferencesVisualGrid } from "@/components/site/references/ReferencesVisualGrid"
import type { Reference } from "@/lib/references"

type ReferencesBrowseProps = {
  references: Reference[]
}

export function ReferencesBrowse({ references }: ReferencesBrowseProps) {
  return (
    <div>
      {references.length > 0 ? (
        <ReferencesVisualGrid references={references} />
      ) : (
        <div className="rounded-[var(--radius-md)] border border-black/8 bg-white/70 px-5 py-10 text-center">
          <p className="text-sm text-black/60">Még nincs publikált referencia.</p>
        </div>
      )}

      <div className="mt-10 rounded-[var(--radius-lg)] border border-black/8 bg-white px-5 py-7 md:px-8 md:py-8">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] md:text-2xl">
          Hasonló projektje van?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/60 md:text-[0.9375rem]">
          Írjon a Kapcsolat oldalon. Emailben válaszolunk.
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
