"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import type { Client, ClientContact } from "@/types/clients"
import { CLIENT_TYPE_LABELS } from "@/lib/client-labels"
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

function normalizePrimary(contacts: ClientContact[], primaryId?: string): ClientContact[] {
  if (!contacts.length) return contacts
  const id = primaryId ?? contacts.find((c) => c.isPrimary)?.id ?? contacts[0].id
  return contacts.map((c) => ({ ...c, isPrimary: c.id === id }))
}

type ClientDetailsTabProps = {
  client: Client
  onSaveNotes: (notes: string) => void | Promise<void>
  onSaveContacts: (contacts: ClientContact[]) => void | Promise<void>
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

export function ClientDetailsTab({ client, onSaveNotes, onSaveContacts }: ClientDetailsTabProps) {
  const [notes, setNotes] = useState(client.internalNotes)
  const [savingNotes, setSavingNotes] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState(emptyContactForm())
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    setNotes(client.internalNotes)
  }, [client.internalNotes, client.id])

  const addressLine = [
    client.billingAddress.postalCode,
    client.billingAddress.city,
    client.billingAddress.street,
  ]
    .filter(Boolean)
    .join(" ")

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await onSaveNotes(notes)
    } finally {
      setSavingNotes(false)
    }
  }

  const openNewContact = () => {
    setEditingContactId(null)
    setContactForm(emptyContactForm())
    setContactOpen(true)
  }

  const openEditContact = (contact: ClientContact) => {
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
      const nextId = editingContactId ?? `cc-${Date.now()}`
      let contacts = [...client.contacts]
      if (editingContactId) {
        contacts = contacts.map((c) =>
          c.id === editingContactId
            ? {
                ...c,
                name: contactForm.name.trim(),
                role: contactForm.role.trim() || undefined,
                email: contactForm.email.trim() || undefined,
                phone: contactForm.phone.trim() || undefined,
                isPrimary: contactForm.isPrimary,
              }
            : c
        )
      } else {
        contacts.push({
          id: nextId,
          name: contactForm.name.trim(),
          role: contactForm.role.trim() || undefined,
          email: contactForm.email.trim() || undefined,
          phone: contactForm.phone.trim() || undefined,
          isPrimary: contactForm.isPrimary,
        })
      }
      contacts = normalizePrimary(
        contacts,
        contactForm.isPrimary ? nextId : undefined
      )
      await onSaveContacts(contacts)
      setContactOpen(false)
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Törlöd a kapcsolattartót?")) return
    const contacts = normalizePrimary(client.contacts.filter((c) => c.id !== id))
    await onSaveContacts(contacts)
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Block title="Alapadatok">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Típus">{CLIENT_TYPE_LABELS[client.clientType]}</Field>
          <Field label="Jogi / teljes név">{client.legalName}</Field>
          {client.taxNumber ? <Field label="Adószám">{client.taxNumber}</Field> : null}
          {client.companyRegNumber ? (
            <Field label="Cégjegyzékszám">{client.companyRegNumber}</Field>
          ) : null}
          {client.email ? <Field label="Email">{client.email}</Field> : null}
          {client.phone ? <Field label="Telefon">{client.phone}</Field> : null}
          {addressLine ? <Field label="Számlázási cím">{addressLine}</Field> : null}
          {client.defaultPaymentTerms ? (
            <Field label="Fizetési feltétel">{client.defaultPaymentTerms}</Field>
          ) : null}
        </dl>
      </Block>

      <Block title="Kapcsolattartók">
        <div className="mb-3 flex justify-end">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={openNewContact}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Hozzáadás
          </Button>
        </div>
        {client.contacts.length === 0 ? (
          <p className="text-sm text-slate-600">Nincs rögzített kapcsolattartó.</p>
        ) : (
          <ul className="space-y-3">
            {client.contacts.map((c) => (
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
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => void handleDeleteContact(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Belső megjegyzés">
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void handleSaveNotes()} disabled={savingNotes}>
            {savingNotes ? "Mentés…" : "Megjegyzés mentése"}
          </Button>
        </div>
      </Block>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContactId ? "Kapcsolat szerkesztése" : "Új kapcsolattartó"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Név</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Szerep</Label>
              <Input
                value={contactForm.role}
                onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={contactForm.isPrimary}
                onCheckedChange={(v) => setContactForm((f) => ({ ...f, isPrimary: v === true }))}
              />
              Elsődleges kapcsolat
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
              Mégse
            </Button>
            <Button type="button" onClick={() => void handleSaveContact()} disabled={savingContact}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
