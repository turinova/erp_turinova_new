import {
  CalendarClock,
  Globe,
  Mail,
  MapPin,
  Navigation,
  Phone
} from 'lucide-react'

import {
  groupWeek,
  type OpenStatus,
  type OpeningHours
} from '@/lib/opening-hours'
import type { PartnerHomeContact } from '@/lib/partner/home-queries'
import { cn } from '@/lib/utils'

function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

function mapsHref(companyName: string | null, addressLine: string): string {
  const query = [companyName, addressLine].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function ContactCard({
  companyName,
  contact,
  openingHours,
  openingHoursNote,
  status
}: {
  companyName: string | null
  contact: PartnerHomeContact | null
  openingHours: OpeningHours | null
  openingHoursNote: string | null
  /** Szerveren számolva (Europe/Budapest) — nincs hydration eltérés. */
  status: OpenStatus | null
}) {
  const week = openingHours ? groupWeek(openingHours) : []
  const nothing = !contact && !openingHours && !openingHoursNote

  return (
    <section
      aria-labelledby="home-contact"
      className="rounded-lg border border-border bg-surface"
    >
      <div className="border-b border-border px-5 py-3.5">
        <h2 id="home-contact" className="text-[17px] font-semibold text-ink">
          Kapcsolat
        </h2>
        {companyName ? (
          <p className="text-[15px] text-ink-secondary">{companyName}</p>
        ) : null}
        {status ? (
          <p
            className={cn(
              'mt-2 inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[14px] font-semibold',
              status.open
                ? 'bg-success-soft text-success-ink'
                : 'bg-danger-soft text-danger-ink'
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                status.open ? 'bg-success' : 'bg-danger'
              )}
              aria-hidden
            />
            {status.label}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4">
        {nothing ? (
          <p className="text-[15px] text-ink-secondary">
            A cég még nem adta meg az elérhetőségét.
          </p>
        ) : null}

        {contact?.phone ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-soft px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Phone className="size-5 text-success-ink" aria-hidden />
              <span className="text-[19px] font-semibold tabular-nums text-ink">
                {contact.phone}
              </span>
            </div>
            <a
              href={`tel:${contact.phone.replace(/\s/g, '')}`}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-success px-4 text-[15px] font-semibold text-white no-underline hover:bg-success-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
            >
              <Phone className="size-4" aria-hidden />
              Hívás
            </a>
          </div>
        ) : null}

        {contact?.addressLine ? (
          <div className="flex gap-2.5">
            <MapPin className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
            <div className="min-w-0">
              <p className="text-[15px] text-ink">{contact.addressLine}</p>
              <a
                href={mapsHref(companyName, contact.addressLine)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[14px] font-medium text-ink no-underline hover:bg-subtle"
              >
                <Navigation className="size-4" aria-hidden />
                Útvonaltervezés
                <span className="sr-only">(új lapon nyílik)</span>
              </a>
            </div>
          </div>
        ) : null}

        {contact?.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2.5 text-[15px] text-ink no-underline hover:underline"
          >
            <Mail className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : null}

        {contact?.website ? (
          <a
            href={websiteHref(contact.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-[15px] text-ink no-underline hover:underline"
          >
            <Globe className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <span className="truncate">
              {contact.website.replace(/^https?:\/\//i, '')}
            </span>
          </a>
        ) : null}

        {week.length > 0 ? (
          <div>
            <h3 className="mb-1.5 text-[15px] font-semibold text-ink">
              Nyitvatartás
            </h3>
            <dl className="overflow-hidden rounded-md border border-border text-[15px]">
              {week.map((row) => {
                const isToday = status ? row.days.includes(status.today) : false
                return (
                  <div
                    key={row.label}
                    className={cn(
                      'flex justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0',
                      isToday && 'bg-subtle font-semibold'
                    )}
                  >
                    <dt className="text-ink">
                      {row.label}
                      {isToday ? (
                        <span className="ml-1.5 text-[13px] font-medium text-ink-secondary">
                          (ma)
                        </span>
                      ) : null}
                    </dt>
                    <dd
                      className={cn(
                        'tabular-nums',
                        row.text === 'Zárva' ? 'text-ink-muted' : 'text-ink'
                      )}
                    >
                      {row.text}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ) : null}

        {openingHoursNote ? (
          <p className="flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-[14px] text-warning-ink">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {openingHoursNote}
          </p>
        ) : null}
      </div>
    </section>
  )
}
