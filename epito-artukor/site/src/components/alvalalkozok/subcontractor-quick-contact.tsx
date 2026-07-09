"use client"

import { Mail, Phone, User } from "lucide-react"
import type { Subcontractor } from "@/types/subcontractors"

type SubcontractorQuickContactProps = {
  sub: Subcontractor
}

export function SubcontractorQuickContact({ sub }: SubcontractorQuickContactProps) {
  const primary = sub.contacts.find((c) => c.isPrimary) ?? sub.contacts[0]
  const name = primary?.name ?? sub.displayName
  const email = primary?.email ?? sub.email
  const phone = primary?.phone ?? sub.phone

  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Elérhetőség
      </p>
      {!email && !phone ? (
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
        </div>
      )}
    </section>
  )
}
