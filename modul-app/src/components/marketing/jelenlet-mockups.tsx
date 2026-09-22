import { Check, FileDown, Plus } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { cn } from '@/lib/utils'

/**
 * Statikus, nem interaktív másolatai a jelenlét modul képernyőinek.
 * A cella- és badge-osztályok szándékosan azonosak az éles komponensekkel
 * (`jelenlet-calendar-client`, `data-table`, `status-badge`), hogy a landing
 * ugyanazt mutassa, amit a belépő felhasználó lát.
 */

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: React.ReactNode
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

/** Ál-gomb: gombnak látszik, de nem fókuszálható vezérlő. */
function FakeButton({
  children,
  variant = 'secondary'
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium',
        variant === 'primary'
          ? 'bg-primary text-white'
          : 'border border-border bg-surface text-ink'
      )}
    >
      {children}
    </span>
  )
}

function FakeCheckbox({ checked }: { checked?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-3.5 items-center justify-center rounded border',
        checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface'
      )}
      aria-hidden
    >
      {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
    </span>
  )
}

/**
 * A naptár celláinak állapotai. A landingen kiírjuk a szavakat (Szabadság,
 * Beteg, nincs adat), mert jelkulcs nélkül is érthetőnek kell lennie.
 */
type MockCell =
  | { kind: 'complete' }
  | { kind: 'incomplete'; text: string }
  | { kind: 'vacation' }
  | { kind: 'sick' }
  | { kind: 'missing' }
  | { kind: 'rest' }

const CELL_CLASS: Record<MockCell['kind'], string> = {
  complete: 'bg-surface text-ink',
  incomplete: 'bg-surface text-warning-ink ring-1 ring-inset ring-warning/50',
  vacation: 'bg-info-soft/60 text-info-ink',
  sick: 'bg-warning-soft/50 text-warning-ink',
  missing: 'bg-surface text-ink-muted ring-1 ring-inset ring-warning/40',
  rest: 'bg-subtle/70 text-ink-muted'
}

function cellText(cell: MockCell): string {
  switch (cell.kind) {
    case 'complete':
      return '08:00–16:00'
    case 'incomplete':
      return cell.text
    case 'vacation':
      return 'Szabadság'
    case 'sick':
      return 'Beteg'
    case 'missing':
      return 'nincs adat'
    case 'rest':
      return 'Pihenőnap'
  }
}

const DAYS = [
  { day: 16, dow: 'hétfő' },
  { day: 17, dow: 'kedd' },
  { day: 18, dow: 'szerda' },
  { day: 19, dow: 'csütörtök' },
  { day: 20, dow: 'péntek' },
  { day: 21, dow: 'szombat' },
  { day: 22, dow: 'vasárnap' }
] as const

const C: Record<string, MockCell> = {
  ok: { kind: 'complete' },
  sz: { kind: 'vacation' },
  b: { kind: 'sick' },
  miss: { kind: 'missing' },
  rest: { kind: 'rest' }
}

const ROWS: Array<{ name: string; note?: string; cells: MockCell[] }> = [
  {
    name: 'Kovács Anna',
    cells: [C.ok, C.ok, C.ok, C.ok, C.ok, C.rest, C.rest]
  },
  {
    name: 'Nagy Péter',
    note: 'Hiányos nap',
    cells: [
      C.ok,
      { kind: 'incomplete', text: '07:45 – ?' },
      C.ok,
      C.ok,
      C.ok,
      C.rest,
      C.rest
    ]
  },
  {
    name: 'Szabó Judit',
    cells: [C.sz, C.sz, C.sz, C.sz, C.sz, C.rest, C.rest]
  },
  {
    name: 'Tóth Gábor',
    note: 'Nincs rögzítve',
    cells: [C.ok, C.ok, C.miss, C.ok, C.ok, C.rest, C.rest]
  },
  {
    name: 'Varga Éva',
    cells: [C.ok, C.ok, C.ok, C.b, C.b, C.rest, C.rest]
  }
]

/** Havi jelenlét-rács — a `/jelenlet` képernyő egy hete. */
export function JelenletCalendarMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="optinova.hu/jelenlet" className={className}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold text-ink">
          2026. március 16–22.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="warning" variant="soft">
            1 nap nincs rögzítve
          </StatusBadge>
          <StatusBadge tone="warning" variant="soft">
            1 hiányos nap
          </StatusBadge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-subtle">
              <th className="min-w-[8rem] border-b border-r border-border px-3 py-2 text-left font-medium text-ink">
                Dolgozó
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.day}
                  className="min-w-[5.5rem] border-b border-border px-2 py-1.5 text-center font-medium text-ink-secondary"
                >
                  <div className="text-ink">{d.day}.</div>
                  <div className="text-[11px] font-normal">{d.dow}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name}>
                <td className="border-b border-r border-border px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">{row.name}</span>
                    {row.note ? (
                      <span className="text-[11px] font-medium text-warning-ink">
                        {row.note}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-muted">Rendben</span>
                    )}
                  </div>
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={`${row.name}-${i}`}
                    className="border-b border-border p-0"
                  >
                    <div
                      className={cn(
                        'flex h-12 w-full items-center justify-center whitespace-nowrap px-2 text-center tabular-nums',
                        CELL_CLASS[cell.kind]
                      )}
                    >
                      {cellText(cell)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppFrame>
  )
}

const EMPLOYEE_ROWS = [
  {
    name: 'Kovács Anna',
    code: 'D-001',
    type: 'Bolt',
    selected: true,
    empty: 0,
    incomplete: 0
  },
  {
    name: 'Nagy Péter',
    code: 'D-002',
    type: 'Műhely',
    selected: true,
    empty: 0,
    incomplete: 1
  },
  {
    name: 'Szabó Judit',
    code: 'D-003',
    type: 'Iroda',
    selected: false,
    empty: 0,
    incomplete: 0
  },
  {
    name: 'Tóth Gábor',
    code: 'D-004',
    type: 'Műhely',
    selected: false,
    empty: 1,
    incomplete: 0
  }
] as const

/** Dolgozók lista + hivatalos PDF export — a `/dolgozok` képernyő mása. */
export function EmployeesListMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="optinova.hu/dolgozok" className={className}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">Dolgozók</p>
          <p className="text-[11px] text-ink-secondary">
            Március 2026 — hiányos napok figyelése.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <FakeButton>
            <FileDown className="size-3.5" aria-hidden />
            Hivatalos PDF (2)
          </FakeButton>
          <FakeButton variant="primary">
            <Plus className="size-3.5" aria-hidden />
            Új dolgozó
          </FakeButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead className="border-b border-border bg-subtle">
            <tr>
              <th className="h-8 w-8 px-3">
                <FakeCheckbox />
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Név
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Típus
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Hiányzó nap
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Hiányos nap
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {EMPLOYEE_ROWS.map((row) => (
              <tr key={row.code} className="bg-surface">
                <td className="h-10 px-3">
                  <FakeCheckbox checked={row.selected} />
                </td>
                <td className="h-10 px-3">
                  <span className="font-medium text-ink">{row.name}</span>
                  <span className="ml-1.5 text-ink-muted">{row.code}</span>
                </td>
                <td className="h-10 px-3 text-ink">{row.type}</td>
                <td className="h-10 px-3 tabular-nums">
                  <span
                    className={
                      row.empty > 0 ? 'text-warning-ink' : 'text-ink-muted'
                    }
                  >
                    {row.empty}
                  </span>
                </td>
                <td className="h-10 px-3 tabular-nums">
                  <span
                    className={
                      row.incomplete > 0 ? 'text-warning-ink' : 'text-ink-muted'
                    }
                  >
                    {row.incomplete}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-ink-secondary">
        1–4 / 4 · 2 kijelölve
      </p>
    </AppFrame>
  )
}

const CALENDAR_ROWS = [
  {
    date: '2026.03.15.',
    dow: 'V',
    tone: 'info' as const,
    type: 'Nemzeti ünnep',
    name: 'Nemzeti ünnep'
  },
  {
    date: '2026.08.20.',
    dow: 'Cs',
    tone: 'info' as const,
    type: 'Nemzeti ünnep',
    name: 'Az államalapítás ünnepe'
  },
  {
    date: '2026.08.21.',
    dow: 'P',
    tone: 'neutral' as const,
    type: 'Áthelyezett pihenőnap',
    name: 'Áthelyezett pihenőnap'
  },
  {
    date: '2026.08.29.',
    dow: 'Szo',
    tone: 'success' as const,
    type: 'Áthelyezett munkanap',
    name: 'Ledolgozós szombat'
  },
  {
    date: '2026.12.24.',
    dow: 'Cs',
    tone: 'warning' as const,
    type: 'Céges munkaszünet',
    name: 'Céges szünnap'
  }
] as const

/** Munkarend / ünnepek — a `/jelenlet/naptar` képernyő mása. */
export function WorkCalendarMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="optinova.hu/jelenlet/naptar" className={className}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">
            Munkarend / ünnepek
          </p>
          <p className="text-[11px] text-ink-secondary">
            Minden dolgozóra érvényes napok.
          </p>
        </div>
        <FakeButton>Nemzeti ünnepek betöltése</FakeButton>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead className="border-b border-border bg-subtle">
            <tr>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Dátum
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Nap
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Típus
              </th>
              <th className="h-8 px-3 text-[12px] font-medium text-ink-secondary">
                Név
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CALENDAR_ROWS.map((row) => (
              <tr key={row.date} className="bg-surface">
                <td className="h-10 px-3 font-medium tabular-nums text-ink">
                  {row.date}
                </td>
                <td className="h-10 px-3 text-ink-secondary">{row.dow}</td>
                <td className="h-10 px-3">
                  <StatusBadge tone={row.tone}>{row.type}</StatusBadge>
                </td>
                <td className="h-10 px-3 text-ink">{row.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppFrame>
  )
}

/** Túlóra-szabály — a dolgozó adatlap „Túlóra” szekciójának mása. */
export function OvertimeFormMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="optinova.hu/dolgozok/nagy-peter" className={className}>
      <section className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-2.5 space-y-0.5">
          <p className="text-[14px] font-semibold text-ink">Túlóra</p>
          <p className="text-[11px] text-ink-secondary">
            Egyszerű műszak utáni túlóra szabály.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <span
            className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-primary bg-primary"
            aria-hidden
          >
            <span className="absolute left-0.5 top-0.5 size-3.5 translate-x-4 rounded-full bg-white shadow-sm" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">
              Túlóra számítás
            </p>
            <p className="mt-0.5 text-[11px] text-ink-secondary">
              Ha ki van kapcsolva, nincs túlóra a naptár összesítőben.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Türelmi idő (perc)
            </span>
            <span className="flex h-8 items-center rounded-md border border-border bg-surface px-2.5 text-[13.5px] tabular-nums text-ink">
              15
            </span>
            <span className="text-[11px] text-ink-secondary">
              Ennyi perc után indul a túlóra.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Napi maximum (perc)
            </span>
            <span className="flex h-8 items-center rounded-md border border-border bg-surface px-2.5 text-[13.5px] tabular-nums text-ink">
              180
            </span>
            <span className="text-[11px] text-ink-secondary">
              Ennél több túlórát egy napra nem számol.
            </span>
          </div>
        </div>
      </section>
    </AppFrame>
  )
}
