"use client"

import { useState, type ReactNode } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import type { Subcontractor, SubcontractorContact } from "@/types/subcontractors"
import { getTradeLabel } from "@/lib/trades"
import type { Trade } from "@/types"
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

const emptyContactForm = () => ({
  name: "",
  role: "",
  email: "",
  phone: "",
  isPrimary: false,
})

function normalizePrimary(contacts: SubcontractorContact[], primaryId?: string): SubcontractorContact[] {
  if (!contacts.length) return contacts
  const id = primaryId ?? contacts.find((c) => c.isPrimary)?.id ?? contacts[0].id
  return contacts.map((c) => ({ ...c, isPrimary: c.id === id }))
}

type SubcontractorDetailsTabProps = {
  sub: Subcontractor
  onSaveNotes: (notes: string) => void | Promise<void>
  onSaveContacts: (contacts: SubcontractorContact[]) => void | Promise<void>
  onAddReference: (ref: { title: string; projectName: string; description: string }) => void | Promise<void>
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4 first:border-t-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

export function SubcontractorDetailsTab({
  sub,
  onSaveNotes,
  onSaveContacts,
  onAddReference,
}: SubcontractorDetailsTabProps) {
  const [refOpen, setRefOpen] = useState(false)
  const [refForm, setRefForm] = useState({ title: "", projectName: "", description: "" })
  const [savingRef, setSavingRef] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState(emptyContactForm())
  const [savingContact, setSavingContact] = useState(false)

  const handleAddReference = async () => {
    if (!refForm.title.trim()) return
    setSavingRef(true)
    try {
      await onAddReference(refForm)
      setRefForm({ title: "", projectName: "", description: "" })
      setRefOpen(false)
    } finally {
      setSavingRef(false)
    }
  }

  const openNewContact = () => {
    setEditingContactId(null)
    setContactForm({
      ...emptyContactForm(),
      isPrimary: sub.contacts.length === 0,
    })
    setContactOpen(true)
  }

  const openEditContact = (contact: SubcontractorContact) => {
    setEditingContactId(contact.id)
    setContactForm({
      name: contact.name,
      role: contact.role ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isPrimary: contact.isPrimary,
    })
    setContactOpen(true)
  }

  const handleSaveContact = async () => {
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    try {
      const base: SubcontractorContact = {
        id: editingContactId ?? `sc-${Date.now()}`,
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || undefined,
        email: contactForm.email.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        isPrimary: contactForm.isPrimary,
      }

      const without = editingContactId
        ? sub.contacts.filter((c) => c.id !== editingContactId)
        : sub.contacts

      const next = normalizePrimary(
        [...without, base],
        contactForm.isPrimary ? base.id : undefined
      )

      await onSaveContacts(next)
      setContactOpen(false)
      setEditingContactId(null)
      setContactForm(emptyContactForm())
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: string) => {
    const next = normalizePrimary(sub.contacts.filter((c) => c.id !== id))
    await onSaveContacts(next)
  }

  const sortedRefs = [...sub.references].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <Block title="Cég adatok">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              {sub.email ? (
                <a href={`mailto:${sub.email}`} className="text-blue-700 hover:underline">
                  {sub.email}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Telefon">
              {sub.phone ? (
                <a href={`tel:${sub.phone}`} className="text-blue-700 hover:underline">
                  {sub.phone}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Weboldal">
              {sub.website ? (
                <a
                  href={sub.website}
                  className="text-blue-700 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sub.website}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Cím">{sub.address ?? "—"}</Field>
            {sub.taxNumber ? <Field label="Adószám">{sub.taxNumber}</Field> : null}
          </dl>
        </Block>

        <Block title="Kapcsolattartók">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNewContact}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Hozzáadás
            </Button>
          </div>
          {sub.contacts.length === 0 ? (
            <p className="text-sm text-slate-600">Nincs rögzített kapcsolattartó.</p>
          ) : (
            <ul className="space-y-3">
              {sub.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {c.name}
                      {c.isPrimary ? (
                        <span className="ml-2 text-xs font-semibold text-blue-700">elsődleges</span>
                      ) : null}
                      {c.role ? (
                        <span className="ml-1 font-normal text-slate-500">· {c.role}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-700"
                      onClick={() => openEditContact(c)}
                      aria-label={`${c.name} szerkesztése`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      onClick={() => void handleDeleteContact(c.id)}
                      aria-label={`${c.name} törlése`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Referenciák">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRefOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Hozzáadás
            </Button>
          </div>
          {sortedRefs.length === 0 ? (
            <p className="text-sm text-slate-600">Még nincs referencia.</p>
          ) : (
            <ul className="space-y-2">
              {sortedRefs.map((ref) => (
                <li key={ref.id} className="text-sm">
                  <p className="font-medium text-slate-900">{ref.title}</p>
                  <p className="text-slate-500">
                    {[ref.projectName, ref.year, ref.trade ? getTradeLabel(ref.trade as Trade) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {ref.description ? (
                    <p className="mt-0.5 text-slate-600">{ref.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Belső jegyzet">
          <Textarea
            key={sub.updatedAt}
            defaultValue={sub.internalNotes}
            rows={3}
            placeholder="Megjegyzések — csak a csapat látja."
            onBlur={(e) => {
              void onSaveNotes(e.target.value)
            }}
          />
        </Block>
      </div>

      <Dialog open={refOpen} onOpenChange={setRefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új referencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cím</Label>
              <Input
                value={refForm.title}
                onChange={(e) => setRefForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="pl. Showroom klíma bővítés"
              />
            </div>
            <div className="space-y-2">
              <Label>Projekt neve</Label>
              <Input
                value={refForm.projectName}
                onChange={(e) => setRefForm((f) => ({ ...f, projectName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Leírás</Label>
              <Textarea
                rows={3}
                value={refForm.description}
                onChange={(e) => setRefForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefOpen(false)} disabled={savingRef}>
              Mégse
            </Button>
            <Button onClick={() => void handleAddReference()} disabled={savingRef || !refForm.title.trim()}>
              Hozzáadás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContactId ? "Kapcsolattartó szerkesztése" : "Új kapcsolattartó"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Név</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nagy Péter"
              />
            </div>
            <div className="space-y-2">
              <Label>Szerepkör</Label>
              <Input
                value={contactForm.role}
                onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Árajánlat, projektvezető…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={contactForm.isPrimary}
                onCheckedChange={(v) => setContactForm((f) => ({ ...f, isPrimary: v === true }))}
              />
              Elsődleges kapcsolattartó (RFQ meghíváskor ez jelenik meg)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)} disabled={savingContact}>
              Mégse
            </Button>
            <Button
              onClick={() => void handleSaveContact()}
              disabled={savingContact || !contactForm.name.trim()}
            >
              {editingContactId ? "Mentés" : "Hozzáadás"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
