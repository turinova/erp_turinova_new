"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { Copy, ExternalLink, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RfqCreatedLink } from "@/components/projektek/rfq-create-wizard"

type RfqLinksPanelProps = {
  links: RfqCreatedLink[]
  onClose: () => void
}

type PartnerGroup = {
  key: string
  subcontractorName: string
  accessToken: string
  accessCode: string
  trades: Array<{ tradeLabel: string; packageTitle: string }>
}

function publicRfqUrl(accessToken: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rfq/${accessToken}`
  }
  return `/rfq/${accessToken}`
}

function groupLinksByPartner(links: RfqCreatedLink[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>()
  for (const link of links) {
    const key = `${link.subcontractorName.trim().toLowerCase()}|${link.accessCode}`
    const existing = map.get(key)
    if (existing) {
      existing.trades.push({
        tradeLabel: link.tradeLabel,
        packageTitle: link.packageTitle,
      })
      // Prefer earlier token as canonical (same PIN after unify)
      continue
    }
    map.set(key, {
      key,
      subcontractorName: link.subcontractorName,
      accessToken: link.accessToken,
      accessCode: link.accessCode,
      trades: [{ tradeLabel: link.tradeLabel, packageTitle: link.packageTitle }],
    })
  }
  return [...map.values()].sort((a, b) =>
    a.subcontractorName.localeCompare(b.subcontractorName, "hu")
  )
}

function messageText(group: PartnerGroup): string {
  const url = publicRfqUrl(group.accessToken)
  const trades = group.trades.map((t) => t.tradeLabel).join(", ")
  return [
    `Kedves ${group.subcontractorName}!`,
    "",
    `Árajánlatkérés: ${trades}`,
    `Link: ${url}`,
    `Belépő kód: ${group.accessCode}`,
    "",
    group.trades.length > 1
      ? "A linken egy belépéssel minden szakágot megtalálsz."
      : "A linken megnyitva írd be a kódot, majd töltsd ki az anyag- és díj egységárakat.",
  ].join("\n")
}

export function RfqLinksPanel({ links, onClose }: RfqLinksPanelProps) {
  const groups = useMemo(() => groupLinksByPartner(links), [links])

  const copyOne = (group: PartnerGroup) => {
    navigator.clipboard.writeText(messageText(group))
    toast.success("Üzenet a vágólapon (1 link + kód)")
  }

  const copyUrlOnly = (group: PartnerGroup) => {
    navigator.clipboard.writeText(publicRfqUrl(group.accessToken))
    toast.success("Link másolva")
  }

  const copyAll = () => {
    navigator.clipboard.writeText(groups.map(messageText).join("\n\n—\n\n"))
    toast.success(`${groups.length} partner üzenete a vágólapon`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-4">
        <h2 className="text-lg font-semibold text-emerald-950">Küldés alvállalkozóknak</h2>
        <p className="mt-1 text-sm text-emerald-900">
          <strong>{groups.length} partner</strong>
          {links.length > groups.length
            ? ` · ${links.length} szakág — egy cégnek egy link`
            : null}
          . Másold ki a <strong>linket és a kódot</strong>, majd küldd WhatsApp / SMS / e-mailen.
        </p>
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>Fontos:</strong> az alvállalkozónak a{" "}
          <code className="rounded bg-white px-1 font-mono text-xs">/rfq/…</code> link kell —{" "}
          <em>nem</em> a projekt Bekérés fül címe a böngészőben.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <ul className="space-y-3">
          {groups.map((group) => {
            const url = publicRfqUrl(group.accessToken)
            return (
              <li
                key={group.key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-base font-semibold text-slate-950">
                    {group.subcontractorName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {group.trades.map((t) => t.tradeLabel).join(" · ")}
                    {group.trades.length > 1 ? (
                      <span className="ml-1 text-emerald-800">
                        ({group.trades.length} szakág · 1 link)
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="space-y-2 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Link (ezt kapja a partner)
                    </p>
                    <p className="mt-0.5 break-all font-mono text-sm text-blue-800">{url}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Belépő kód
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-bold tracking-widest text-slate-950">
                      {group.accessCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      className="h-11 gap-1.5 text-sm font-semibold"
                      onClick={() => copyOne(group)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Üzenet másolása
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-1.5 text-sm font-semibold"
                      onClick={() => copyUrlOnly(group)}
                    >
                      <Copy className="h-4 w-4" />
                      Csak link
                    </Button>
                    <Button type="button" variant="ghost" className="h-11 gap-1.5" asChild>
                      <a href={`/rfq/${group.accessToken}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Megnyitás
                      </a>
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" className="h-11" onClick={copyAll}>
          <Copy className="mr-2 h-4 w-4" />
          Összes üzenet másolása
        </Button>
        <Button type="button" className="h-11" onClick={onClose}>
          Kész
        </Button>
      </div>
    </div>
  )
}
