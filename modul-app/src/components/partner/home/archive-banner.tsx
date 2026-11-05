import { Archive, ExternalLink } from 'lucide-react'

import { ARCHIVE_LABEL, ARCHIVE_URL } from '@/lib/partner/archive-notice'

/** Régi customer-portal archívum — mindig látszik a lejáratig (nem bezárható). */
export function ArchiveBanner() {
  return (
    <section
      role="region"
      aria-label="Régi rendelések archívuma"
      className="flex flex-col gap-3 rounded-lg bg-tile-archive px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/15"
          aria-hidden
        >
          <Archive className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug">
            Régi rendeléseid az archívumban vannak
          </h2>
          <p className="mt-0.5 text-[15px] leading-snug text-white/90">
            Ha a régi rendszerben is rendeltél, a korábbi ajánlataidat és
            rendeléseidet itt találod: <strong>{ARCHIVE_LABEL}</strong>. 3
            hónapig érhető el, csak megnézni lehet. Belépés ugyanúgy, mint
            eddig: a régi e-mail címeddel és jelszavaddal.
          </p>
        </div>
      </div>
      <a
        href={ARCHIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 text-[15px] font-semibold text-tile-archive no-underline transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Régi rendeléseim megnyitása
        <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only">(új lapon nyílik)</span>
      </a>
    </section>
  )
}
