"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Client, ClientInput } from "@/types/clients"
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from "@/lib/client-labels"
import { checkClientDuplicates } from "@/lib/data/clients-store"
import { suggestClientCode } from "@/lib/clients/client-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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

const emptyForm = (): ClientInput => ({
  code: "",
  clientType: "individual",
  legalName: "",
  displayName: "",
  taxNumber: "",
  companyRegNumber: "",
  email: "",
  phone: "",
  website: "",
  billingAddress: { postalCode: "", city: "", street: "" },
  useSeparateMailingAddress: false,
  mailingAddress: null,
  defaultPaymentTerms: "",
  status: "active",
  tags: [],
  internalNotes: "",
})

type ClientFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Client
  onSave: (input: ClientInput) => void | Promise<void>
}

export function ClientFormDialog({ open, onOpenChange, initial, onSave }: ClientFormDialogProps) {
  const [form, setForm] = useState<ClientInput>(emptyForm())
  const [tagsText, setTagsText] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        code: initial.code,
        clientType: initial.clientType,
        legalName: initial.legalName,
        displayName: initial.displayName,
        taxNumber: initial.taxNumber ?? "",
        companyRegNumber: initial.companyRegNumber ?? "",
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        website: initial.website ?? "",
        billingAddress: { ...initial.billingAddress },
        useSeparateMailingAddress: initial.useSeparateMailingAddress,
        mailingAddress: initial.mailingAddress ? { ...initial.mailingAddress } : null,
        defaultVatMode: initial.defaultVatMode,
        defaultPaymentTerms: initial.defaultPaymentTerms,
        status: initial.status,
        tags: [...initial.tags],
        internalNotes: initial.internalNotes,
        contacts: initial.contacts,
      })
      setTagsText(initial.tags.join(", "))
    } else {
      setForm(emptyForm())
      setTagsText("")
    }
  }, [open, initial])

  const handleSave = async () => {
    const dup = checkClientDuplicates(
      {
        displayName: form.displayName || form.legalName,
        taxNumber: form.taxNumber,
        code: form.code || suggestClientCode(form.displayName || form.legalName),
      },
      initial?.id
    )
    if (dup) {
      toast.error(dup)
      return
    }

    if (!form.legalName.trim()) {
      toast.error("A név kötelező.")
      return
    }
    if (form.clientType === "company" && !form.taxNumber?.trim()) {
      toast.error("Cégnél az adószám kötelező.")
      return
    }

    const payload: ClientInput = {
      ...form,
      code: form.code.trim() || suggestClientCode(form.displayName || form.legalName),
      displayName: form.displayName.trim() || form.legalName.trim(),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }

    setSaving(true)
    try {
      await onSave(payload)
      onOpenChange(false)
    } catch {
      /* toast in parent */
    } finally {
      setSaving(false)
    }
  }

  const isCompany = form.clientType === "company"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Ügyfél szerkesztése" : "Új ügyfél"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Típus</Label>
              <Select
                value={form.clientType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, clientType: v as Client["clientType"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLIENT_TYPE_LABELS) as Client["clientType"][]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {CLIENT_TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Státusz</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as Client["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLIENT_STATUS_LABELS) as Client["status"][]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {CLIENT_STATUS_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{isCompany ? "Jogi név" : "Teljes név"}</Label>
            <Input
              value={form.legalName}
              onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
              placeholder={isCompany ? "Példa Kft." : "Kovács Anna"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Megjelenített név</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Rövid név listában"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ügyfélkód</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="kovacs-anna"
              />
            </div>
          </div>

          {isCompany ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Adószám</Label>
                <Input
                  value={form.taxNumber}
                  onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cégjegyzékszám</Label>
                <Input
                  value={form.companyRegNumber}
                  onChange={(e) => setForm((f) => ({ ...f, companyRegNumber: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Adóazonosító (opcionális)</Label>
              <Input
                value={form.taxNumber}
                onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
                placeholder="Adószám vagy adóazonosító jel"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium text-slate-900">Számlázási cím</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Ir.sz."
                value={form.billingAddress.postalCode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billingAddress: { ...f.billingAddress, postalCode: e.target.value },
                  }))
                }
              />
              <Input
                placeholder="Város"
                value={form.billingAddress.city}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billingAddress: { ...f.billingAddress, city: e.target.value },
                  }))
                }
              />
              <Input
                className="sm:col-span-1"
                placeholder="Utca, házszám"
                value={form.billingAddress.street}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billingAddress: { ...f.billingAddress, street: e.target.value },
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Fizetési feltétel (alapértelmezett)</Label>
            <Textarea
              rows={2}
              value={form.defaultPaymentTerms}
              onChange={(e) => setForm((f) => ({ ...f, defaultPaymentTerms: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Címkék (vesszővel)</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Belső megjegyzés</Label>
            <Textarea
              rows={2}
              value={form.internalNotes}
              onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Mentés…" : "Mentés"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
