"use client"

import { toast } from "sonner"
import { Copy, ExternalLink } from "lucide-react"
import type { CustomerPackage } from "@/types/projects"
import { customerPackagePublicUrl } from "@/lib/customer-package"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ProjectOfferLinkBlockProps = {
  pkg: CustomerPackage
}

export function ProjectOfferLinkBlock({ pkg }: ProjectOfferLinkBlockProps) {
  if (!pkg.accessToken) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        A link és kód küldés után generálódik.
      </p>
    )
  }

  const url = customerPackagePublicUrl(pkg.accessToken)

  const copyLink = () => {
    const text = pkg.accessCode
      ? `${url}\nBelépési kód: ${pkg.accessCode}`
      : url
    navigator.clipboard.writeText(text)
    toast.success("Link másolva")
  }

  return (
    <div className="space-y-2.5 rounded-md border border-slate-200/90 bg-slate-50/80 p-3">
      <div>
        <Label className="text-[10px] uppercase tracking-wide text-slate-500">Ügyfél link</Label>
        <div className="mt-1 flex gap-2">
          <Input readOnly value={url} className="h-8 font-mono text-xs" />
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
      {pkg.accessCode ? (
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-slate-500">Belépési kód</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={pkg.accessCode} className="h-8 w-28 font-mono text-sm font-semibold" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                navigator.clipboard.writeText(pkg.accessCode!)
                toast.success("Kód másolva")
              }}
            >
              Másolás
            </Button>
          </div>
        </div>
      ) : null}
      {pkg.expiresAt ? (
        <p className="text-[11px] text-slate-500">
          Érvényes:{" "}
          {new Date(pkg.expiresAt).toLocaleDateString("hu-HU", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      ) : null}
    </div>
  )
}
