import type { ReactNode } from 'react'
import { Plus, Search, Users } from 'lucide-react'

import { getNavAccentClasses } from '@/lib/nav-accent'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolat: `/ugyfelek` lista.
 * Layout = `customers-list-client`. Nincs scroll, nincs DB, nincs interaktivitás.
 */

type MockRow = {
  id: string
  name: string
  mobile: string | null
  email: string | null
  city: string | null
}

const ROWS: MockRow[] = [
  {
    id: '1',
    name: 'Kovács Asztalos Kft.',
    mobile: '+36 30 111 2233',
    email: 'info@kovacsasztalos.hu',
    city: 'Kecskemét'
  },
  {
    id: '2',
    name: 'Nagy Péter',
    mobile: '+36 20 445 6677',
    email: 'nagy.peter@email.hu',
    city: 'Szeged'
  },
  {
    id: '3',
    name: 'Bútorház Bt.',
    mobile: '+36 70 998 1122',
    email: 'rendeles@butorhaz.hu',
    city: 'Budapest'
  },
  {
    id: '4',
    name: 'Design Studio',
    mobile: '+36 30 555 0101',
    email: 'hello@designstudio.hu',
    city: 'Debrecen'
  },
  {
    id: '5',
    name: 'Lakberendezés Plus',
    mobile: null,
    email: 'plus@lakberendezes.hu',
    city: 'Győr'
  }
]

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-app shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function UgyfelekListaMockup({ className }: { className?: string }) {
  const tones = getNavAccentClasses('blue')

  return (
    <AppFrame path="turinova.hu/ugyfelek" className={className}>
      <div className="pointer-events-none select-none space-y-3" aria-hidden>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  tones.soft,
                  tones.icon
                )}
              >
                <Users className="size-4" />
              </span>
              <h3 className="text-h1 text-ink">Ügyfelek</h3>
            </div>
            <p className="max-w-xl pl-[42px] text-body text-ink-secondary">
              Kapcsolattartók és számlázási adatok.
            </p>
            <div
              className={cn(
                'ml-[42px] mt-2 h-0.5 w-12 rounded-full',
                tones.bar
              )}
            />
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-white">
            <Plus className="size-3.5" aria-hidden />
            Új ügyfél
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-ink-muted">
              Név / e-mail / telefon / város…
            </span>
          </div>
          <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink">
            Keresés
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="border-b border-border bg-subtle">
              <tr className="text-hint text-ink-secondary">
                <th className="px-2.5 py-2 font-medium">Név</th>
                <th className="px-2.5 py-2 font-medium">Telefon</th>
                <th className="hidden px-2.5 py-2 font-medium sm:table-cell">
                  E-mail
                </th>
                <th className="px-2.5 py-2 font-medium">Város</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => (
                <tr key={row.id} className="bg-surface">
                  <td className="px-2.5 py-2 font-medium text-ink">
                    {row.name}
                  </td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {row.mobile || '—'}
                  </td>
                  <td className="hidden px-2.5 py-2 text-ink-secondary sm:table-cell">
                    {row.email || '—'}
                  </td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {row.city || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  )
}
