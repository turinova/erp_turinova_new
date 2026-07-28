"use client"

import { FilePlus2, FileText, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

type QuoteContractActionsBannerProps = {
  packageTitle?: string
  hasDrift?: boolean
  onPotmunka: () => void
  onNewClientOffer: () => void
  onTrackCost: () => void
  busy?: boolean
}

/**
 * Elfogadott / szerződéses szakág — három egyértelmű út, nincs „átírás”.
 */
export function QuoteContractActionsBanner({
  packageTitle,
  hasDrift,
  onPotmunka,
  onNewClientOffer,
  onTrackCost,
  busy = false,
}: QuoteContractActionsBannerProps) {
  return (
    <div className="shrink-0 border-b border-slate-300 bg-slate-100 px-4 py-3.5">
      <p className="text-base font-semibold text-slate-950">
        Szerződésben
        {packageTitle ? (
          <span className="font-normal text-slate-700"> — {packageTitle}</span>
        ) : null}
      </p>
      <p className="mt-1 max-w-3xl text-sm leading-snug text-slate-700">
        Az ügyfélár nem változtatható. Új munka = pótmunka. Más ár / tartalom = új árajánlat az
        ügyfélnek. A bekerülés továbbra is követhető.
      </p>
      {hasDrift ? (
        <p className="mt-1.5 text-sm font-medium text-amber-900">
          Az élő bekerülés eltér a szerződéstől — a TIG a kiküldött árakon megy.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 gap-2 text-sm font-semibold"
          disabled={busy}
          onClick={onNewClientOffer}
        >
          <FileText className="h-4 w-4" />
          Új árajánlat az ügyfélnek
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 border-slate-300 bg-white text-sm font-semibold"
          disabled={busy}
          onClick={onPotmunka}
        >
          <FilePlus2 className="h-4 w-4" />
          Pótmunka
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 text-sm font-semibold text-slate-800"
          disabled={busy}
          onClick={onTrackCost}
        >
          <Wrench className="h-4 w-4" />
          Csak bekerülés követése
        </Button>
      </div>
    </div>
  )
}
