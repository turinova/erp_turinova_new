"use client"

import { toast } from "sonner"
import { Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RfqCreatedLink } from "@/components/projektek/rfq-create-wizard"

type RfqLinksPanelProps = {
  links: RfqCreatedLink[]
  onClose: () => void
}

export function RfqLinksPanel({ links, onClose }: RfqLinksPanelProps) {
  const copyOne = (link: RfqCreatedLink) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/rfq/${link.accessToken}`
        : `/rfq/${link.accessToken}`
    navigator.clipboard.writeText(
      `${link.subcontractorName} — ${link.tradeLabel}\n${url}\nKód: ${link.accessCode}`
    )
    toast.success("Link másolva")
  }

  const copyAll = () => {
    const text = links
      .map((link) => {
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}/rfq/${link.accessToken}`
            : `/rfq/${link.accessToken}`
        return `${link.subcontractorName} — ${link.tradeLabel}\n${url}\nKód: ${link.accessCode}`
      })
      .join("\n\n")
    navigator.clipboard.writeText(text)
    toast.success(`${links.length} link a vágólapon`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">Bekérések elküldve</h2>
        <p className="mt-1 text-sm text-slate-600">
          {links.length} meghívó készült. Másold ki a linkeket és kódokat, majd küldd el a partnereknek.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead className="ea-table-head sticky top-0 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Partner</th>
              <th className="px-3 py-2 text-left">Szakág</th>
              <th className="px-3 py-2 text-left">Kód</th>
              <th className="px-3 py-2 text-right">Művelet</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const url = `/rfq/${link.accessToken}`
              return (
                <tr key={link.invitationId} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {link.subcontractorName}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{link.tradeLabel}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-800">{link.accessCode}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => copyOne(link)}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Másolás
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" asChild>
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={copyAll}>
          <Copy className="mr-2 h-4 w-4" />
          Összes link másolása
        </Button>
        <Button type="button" onClick={onClose}>
          Kész
        </Button>
      </div>
    </div>
  )
}
