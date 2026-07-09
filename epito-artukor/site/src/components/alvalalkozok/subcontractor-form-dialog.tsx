"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import type { Subcontractor, SubcontractorInput } from "@/types/subcontractors"
import type { Trade } from "@/types"
import { useTradeOptions } from "@/components/trades/trades-provider"
import {
  SUBCONTRACTOR_STATUS_LABELS,
  SUBCONTRACTOR_TIER_LABELS,
} from "@/lib/subcontractor-labels"
import { checkSubcontractorDuplicates } from "@/lib/data/subcontractors-store"
import { suggestSubcontractorCode } from "@/lib/subcontractors/subcontractor-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const emptyForm = (): SubcontractorInput => ({
  code: "",
  legalName: "",
  displayName: "",
  taxNumber: "",
  trades: [],
  tags: [],
  tier: "new",
  status: "prospect",
  email: "",
  phone: "",
  website: "",
  address: "",
  internalNotes: "",
})

type SubcontractorFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Subcontractor
  existingSubcontractors?: Subcontractor[]
  onSave: (input: SubcontractorInput) => void | Promise<void>
}

export function SubcontractorFormDialog({
  open,
  onOpenChange,
  initial,
  existingSubcontractors,
  onSave,
}: SubcontractorFormDialogProps) {
  const tradeOptions = useTradeOptions()
  const [form, setForm] = useState<SubcontractorInput>(emptyForm())
  const [tagsText, setTagsText] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        code: initial.code,
        legalName: initial.legalName,
        displayName: initial.displayName,
        taxNumber: initial.taxNumber ?? "",
        trades: [...initial.trades],
        tags: [...initial.tags],
        tier: initial.tier,
        status: initial.status,
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        website: initial.website ?? "",
        address: initial.address ?? "",
        internalNotes: initial.internalNotes,
        contacts: initial.contacts,
        references: initial.references,
      })
      setTagsText(initial.tags.join(", "))
    } else {
      setForm(emptyForm())
      setTagsText("")
    }
  }, [open, initial])

  const duplicates = checkSubcontractorDuplicates(
    {
      displayName: form.displayName || form.legalName,
      taxNumber: form.taxNumber,
      code: form.code,
    },
    initial?.id,
    existingSubcontractors
  )

  const toggleTrade = (trade: Trade) => {
    setForm((f) => ({
      ...f,
      trades: f.trades.includes(trade)
        ? f.trades.filter((t) => t !== trade)
        : [...f.trades, trade],
    }))
  }

  const handleSave = async () => {
    if (!form.legalName.trim()) {
      toast.error("Add meg a cég nevét")
      return
    }
    if (!form.code.trim()) {
      toast.error("Add meg a partnerkódot")
      return
    }
    if (form.trades.length === 0) {
      toast.error("Válassz legalább egy szakágat")
      return
    }

    const payload: SubcontractorInput = {
      ...form,
      legalName: form.legalName.trim(),
      displayName: (form.displayName || form.legalName).trim(),
      code: form.code.trim(),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      contacts: initial?.contacts ?? [],
      references: initial?.references ?? [],
    }

    setSaving(true)
    try {
      await onSave(payload)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Partner szerkesztése" : "Új alvállalkozó"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Partnerkód</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="klima-pro"
              className="font-code"
            />
            <p className="text-xs text-slate-500">
              Egyedi azonosító linkekhez (pl. RFQ). Csak kisbetű, szám és kötőjel.
            </p>
            {!initial && !form.code && form.displayName ? (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    code: suggestSubcontractorCode(f.displayName || f.legalName),
                  }))
                }
              >
                Javaslat: {suggestSubcontractorCode(form.displayName || form.legalName)}
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Cég neve (hivatalos)</Label>
            <Input
              value={form.legalName}
              onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
              placeholder="Klima-Pro Kft."
            />
          </div>
          <div className="space-y-2">
            <Label>Megjelenő név</Label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Klima-Pro"
            />
          </div>
          <div className="space-y-2">
            <Label>Adószám</Label>
            <Input
              value={form.taxNumber}
              onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
              placeholder="12345678-2-13"
            />
          </div>

          {duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {duplicates.map((d) => (
                <p key={d.field}>
                  Hasonló partner már létezik ({d.field === "code" ? "kód" : d.field}):{" "}
                  <Link href={`/alvalalkozok/${d.existingCode}`} className="font-medium underline">
                    {d.existingName}
                  </Link>
                </p>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Szakágak</Label>
            <div className="flex flex-wrap gap-2">
              {tradeOptions.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={form.trades.includes(t.id)}
                    onCheckedChange={() => toggleTrade(t.id)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select
                value={form.tier}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tier: v as Subcontractor["tier"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBCONTRACTOR_TIER_LABELS) as Subcontractor["tier"][]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {SUBCONTRACTOR_TIER_LABELS[k]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Státusz</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as Subcontractor["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBCONTRACTOR_STATUS_LABELS) as Subcontractor["status"][]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {SUBCONTRACTOR_STATUS_LABELS[k]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Weboldal</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://"
            />
          </div>

          <div className="space-y-2">
            <Label>Cím</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Címkék (vesszővel)</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Belső jegyzet</Label>
            <Textarea
              rows={3}
              value={form.internalNotes}
              onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {initial ? "Mentés" : "Létrehozás"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
