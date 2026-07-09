"use client"

import { Mail, MapPin, Phone, User } from "lucide-react"
import type { Client } from "@/types/clients"

type ClientQuickContactProps = {
  client: Client
}

export function ClientQuickContact({ client }: ClientQuickContactProps) {
  const primary = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0]
  const name = primary?.name ?? client.displayName
  const email = primary?.email ?? client.email
  const phone = primary?.phone ?? client.phone
  const address = [
    client.billingAddress.postalCode,
    client.billingAddress.city,
    client.billingAddress.street,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Elérhetőség
      </p>
      {!email && !phone && !address ? (
        <p className="text-sm text-slate-600">
          Nincs rögzített elérhetőség — a Részletek fülön adhatod meg.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
            <User className="h-3.5 w-3.5 text-slate-400" />
            {name}
            {primary?.role ? (
              <span className="font-normal text-slate-500">· {primary.role}</span>
            ) : null}
          </span>
          {email ? (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              {email}
            </a>
          ) : null}
          {phone ? (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              {phone}
            </a>
          ) : null}
          {address ? (
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {address}
            </span>
          ) : null}
        </div>
      )}
    </section>
  )
}
