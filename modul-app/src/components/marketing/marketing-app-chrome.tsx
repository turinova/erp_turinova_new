import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Factory,
  Home,
  PanelLeftClose,
  Scale,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Banknote,
  ScanBarcode,
  ScanSearch,
  ClipboardList,
  Receipt,
  CircleDollarSign,
  Percent,
  FileText
} from 'lucide-react'
import Image from 'next/image'

import { getNavAccentClasses, type NavAccent } from '@/lib/nav-accent'
import { cn } from '@/lib/utils'

/**
 * Statikus app-shell chrome — 1:1 az éles `AppSidebar` + `AppTopbar` layouttal.
 * Groupok mindig zárva. Nincs fetch, nincs entitlement, nincs Webshop.
 */

type NavItem =
  | {
      kind: 'link'
      label: string
      icon: LucideIcon
      accent: NavAccent
      active?: boolean
    }
  | { kind: 'group'; label: string; icon: LucideIcon; accent: NavAccent }

type NavSection = {
  label: string | null
  items: NavItem[]
}

/** Sorrend / címkék = `navigation.ts` mainNavSections (WEBSHOP_ENABLED=false). */
const MOCK_NAV: NavSection[] = [
  {
    label: null,
    items: [
      { kind: 'link', label: 'Kezdőlap', icon: Home, accent: 'slate', active: true }
    ]
  },
  {
    label: 'Pult',
    items: [
      { kind: 'link', label: 'Kereső', icon: Search, accent: 'cyan' },
      { kind: 'link', label: 'Opti', icon: ScanSearch, accent: 'violet' },
      { kind: 'link', label: 'Scanner', icon: ScanBarcode, accent: 'amber' },
      { kind: 'link', label: 'POS', icon: Banknote, accent: 'emerald' },
      { kind: 'link', label: 'Belépők', icon: UsersRound, accent: 'rose' }
    ]
  },
  {
    label: 'Ügyfél',
    items: [
      { kind: 'link', label: 'Ügyfelek', icon: Users, accent: 'blue' },
      {
        kind: 'group',
        label: 'Ügyfélrendelések',
        icon: ClipboardList,
        accent: 'blue'
      }
    ]
  },
  {
    label: 'Értékesítés',
    items: [
      {
        kind: 'group',
        label: 'Értékesítés',
        icon: ShoppingCart,
        accent: 'teal'
      }
    ]
  },
  {
    label: 'Pénzügy',
    items: [
      { kind: 'link', label: 'Áttekintés', icon: Wallet, accent: 'teal' },
      { kind: 'link', label: 'Bizonylatok', icon: Receipt, accent: 'teal' },
      {
        kind: 'link',
        label: 'Kintlévőség',
        icon: CircleDollarSign,
        accent: 'teal'
      },
      { kind: 'link', label: 'ÁFA összesítő', icon: Percent, accent: 'teal' },
      { kind: 'link', label: 'Exportok', icon: FileText, accent: 'teal' }
    ]
  },
  {
    label: 'Gyártás',
    items: [
      { kind: 'group', label: 'Lapszabászat', icon: Factory, accent: 'emerald' }
    ]
  },
  {
    label: 'Beszerzés & készlet',
    items: [
      { kind: 'group', label: 'Beszerzés', icon: Truck, accent: 'amber' },
      { kind: 'group', label: 'Készlet', icon: Warehouse, accent: 'cyan' }
    ]
  },
  {
    label: 'Csapat',
    items: [
      { kind: 'group', label: 'Jelenlét', icon: CalendarDays, accent: 'rose' }
    ]
  },
  {
    label: 'Rendszer',
    items: [
      { kind: 'group', label: 'Törzsadatok', icon: BookMarked, accent: 'blue' },
      { kind: 'group', label: 'Beállítások', icon: Settings, accent: 'slate' }
    ]
  }
]

/** = `NavLinkItem` / `NavGroupItem` (depth 0, expanded, children rejtve). */
function NavRow({ item }: { item: NavItem }) {
  const accent = getNavAccentClasses(item.accent)
  const Icon = item.icon
  const active = item.kind === 'link' && Boolean(item.active)

  if (item.kind === 'group') {
    return (
      <div
        className={cn(
          'relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left',
          'text-ink-secondary'
        )}
      >
        <Icon
          className={cn('size-4 shrink-0 opacity-90', accent.iconMuted)}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {item.label}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-ink-muted"
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-2 rounded-md px-2',
        active
          ? cn(accent.soft, accent.ink)
          : 'text-ink-secondary'
      )}
    >
      {active ? (
        <span
          className={cn(
            'absolute left-0 top-1 bottom-1 w-1 rounded-r-sm',
            accent.bar
          )}
          aria-hidden
        />
      ) : null}
      <Icon
        className={cn(
          'size-4 shrink-0',
          active ? accent.icon : cn(accent.iconMuted, 'opacity-90')
        )}
        aria-hidden
      />
      <span
        className={cn(
          'truncate text-[13px]',
          active ? 'font-semibold' : 'font-medium'
        )}
      >
        {item.label}
      </span>
    </div>
  )
}

function MockSidebar() {
  const subscriptionAccent = getNavAccentClasses('slate')

  return (
    <aside
      className="flex h-full w-sidebar shrink-0 flex-col border-r border-border bg-surface"
      aria-hidden
    >
      {/* Logo row = h-topbar */}
      <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
        <Image
          src="/images/turinova-logo.png"
          alt="Turinova"
          width={160}
          height={32}
          className="h-8 w-auto"
        />
      </div>

      {/* Scrollable nav — mint az éles overflow-y-auto */}
      <nav
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
        aria-label="Főmenü"
      >
        {MOCK_NAV.map((section, sectionIndex) => (
          <div
            key={section.label ?? `section-${sectionIndex}`}
            className={cn(sectionIndex > 0 && 'mt-2.5')}
          >
            {section.label ? (
              <p className="mb-1 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {section.label}
              </p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavRow
                  key={`${section.label ?? 'root'}-${item.label}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer sticky a chrome alján (= éles fixed sidebar alja) */}
      <div className="mt-auto shrink-0 border-t border-border bg-surface">
        <div className="px-2 pt-2.5">
          <div
            className={cn(
              'relative flex h-8 items-center gap-2 rounded-md px-2',
              'text-ink-secondary'
            )}
          >
            <CreditCard
              className={cn('size-4 shrink-0', subscriptionAccent.iconMuted)}
              aria-hidden
            />
            <span className="truncate text-[13px] font-medium">Előfizetés</span>
          </div>
        </div>

        {/* = AppLegalLinks variant="sidebar" (zárva) */}
        <div className="px-2 py-1.5">
          <div className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-ink-secondary">
            <Scale className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
              Jogi
            </span>
            <ChevronDown
              className="size-3.5 shrink-0 text-ink-muted"
              aria-hidden
            />
          </div>
        </div>

        <div className="border-t border-border p-2">
          <div className="inline-flex h-8 w-full items-center justify-start gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-secondary">
            <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            <span>Összecsukás</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MockTopbar({
  companyName,
  roleLabel,
  userName,
  initials
}: {
  companyName: string
  roleLabel: string
  userName: string
  initials: string
}) {
  return (
    <header className="flex h-topbar shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 md:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {companyName}
        </p>
        <p className="truncate text-hint text-ink-secondary">{roleLabel}</p>
      </div>
      <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1">
        <span
          className="flex size-6 items-center justify-center rounded-full border border-border bg-subtle text-[10px] font-semibold text-ink"
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden max-w-[160px] truncate text-[12.5px] text-ink-secondary sm:inline">
          {userName}
        </span>
        <ChevronDown className="size-3.5 text-ink-secondary" aria-hidden />
      </div>
    </header>
  )
}

export function MarketingAppChrome({
  children,
  className,
  companyName = 'Minta Kft.',
  roleLabel = 'Tulajdonos',
  userName = 'Kovács Anna',
  initials = 'KA'
}: {
  children: ReactNode
  className?: string
  companyName?: string
  roleLabel?: string
  userName?: string
  initials?: string
}) {
  return (
    <div
      className={cn(
        /* Fix viewport: napi eloszlásig látszik, nincs scroll. */
        'flex h-[680px] min-w-[1100px] overflow-hidden rounded-xl border border-border bg-app shadow-sm md:h-[720px]',
        className
      )}
    >
      <MockSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MockTopbar
          companyName={companyName}
          roleLabel={roleLabel}
          userName={userName}
          initials={initials}
        />
        <main className="min-h-0 flex-1 overflow-hidden bg-app px-4 pb-6 pt-4 md:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
