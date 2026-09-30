'use client'

import {
  ChevronDown,
  CreditCard,
  Menu,
  PanelLeftClose,
  PanelLeft,
  X
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { AppLegalLinks } from '@/components/shell/app-legal-links'
import { Button } from '@/components/ui/button'
import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  isNavLink,
  mainNavSections,
  navGroupIsActive,
  pathIsActive,
  type NavGroup,
  type NavLink,
  type NavNode,
  type NavSection
} from '@/lib/navigation'
import { filterNavSectionsByAccess } from '@/lib/permissions/filter-nav'
import { cn } from '@/lib/utils'

type AppSidebarProps = {
  allowedPages: string[]
  /** Csak tenant owner látja az Előfizetés linket. */
  showSubscription: boolean
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function AppSidebar({
  allowedPages,
  showSubscription,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange
}: AppSidebarProps) {
  const pathname = usePathname()
  const navSections = filterNavSectionsByAccess(mainNavSections, allowedPages)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => closeRef.current?.focus(), 0)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen, onMobileOpenChange])

  // Útvonalváltáskor zárjuk a mobil menüt
  useEffect(() => {
    onMobileOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- csak pathname
  }, [pathname])

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-fast ease-flat md:flex',
          collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
        )}
        aria-label="Oldalsáv"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <SidebarChrome
          collapsed={collapsed}
          showCollapse
          onCollapsedChange={onCollapsedChange}
          showSubscription={showSubscription}
          pathname={pathname}
          navSections={navSections}
          onExpandSidebar={() => onCollapsedChange(false)}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menü bezárása"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(100%-3rem,280px)] flex-col border-r border-border bg-surface shadow-elev3"
            aria-labelledby={titleId}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <Link
                href="/home"
                className="flex items-center no-underline"
                aria-label="Turinova kezdőlap"
                onClick={() => onMobileOpenChange(false)}
              >
                <Image
                  src="/images/turinova-logo.png"
                  alt="Turinova"
                  width={160}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
              <p id={titleId} className="sr-only">
                Főmenü
              </p>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="sm"
                className="size-10 shrink-0 p-0"
                aria-label="Menü bezárása"
                onClick={() => onMobileOpenChange(false)}
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <SidebarChrome
              collapsed={false}
              showCollapse={false}
              onCollapsedChange={onCollapsedChange}
              showSubscription={showSubscription}
              pathname={pathname}
              navSections={navSections}
              onExpandSidebar={() => undefined}
              onNavigate={() => onMobileOpenChange(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  )
}

function SidebarChrome({
  collapsed,
  showCollapse,
  onCollapsedChange,
  showSubscription,
  pathname,
  navSections,
  onExpandSidebar,
  onNavigate
}: {
  collapsed: boolean
  showCollapse: boolean
  onCollapsedChange: (collapsed: boolean) => void
  showSubscription: boolean
  pathname: string
  navSections: NavSection[]
  onExpandSidebar: () => void
  onNavigate?: () => void
}) {
  const subscriptionActive = pathIsActive(pathname, '/beallitasok/elofizetes')
  const subscriptionAccent = getNavAccentClasses('slate')

  return (
    <>
      {showCollapse ? (
        <div
          className={cn(
            'flex h-topbar shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center px-1.5' : 'px-3'
          )}
        >
          <Link
            href="/home"
            className="flex items-center no-underline"
            aria-label="Turinova kezdőlap"
          >
            {collapsed ? (
              <Image
                src="/images/turinova-small-icon.png"
                alt="Turinova"
                width={32}
                height={32}
                className="size-8 object-contain"
                priority
              />
            ) : (
              <Image
                src="/images/turinova-logo.png"
                alt="Turinova"
                width={160}
                height={32}
                className="h-8 w-auto"
                priority
              />
            )}
          </Link>
        </div>
      ) : null}

      <nav
        className={cn(
          'mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2',
          collapsed ? 'px-1.5' : 'px-2'
        )}
        aria-label="Főmenü"
      >
        {navSections.map((section, sectionIndex) => (
          <div
            key={section.label ?? `section-${sectionIndex}`}
            className={cn(sectionIndex > 0 && 'mt-2.5')}
          >
            {section.label && !collapsed ? (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {section.label}
              </p>
            ) : null}
            {section.label && collapsed && sectionIndex > 0 ? (
              <div
                className="mx-auto mb-1.5 h-px w-4 bg-border"
                role="separator"
                aria-hidden
              />
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((node) => (
                <NavNodeItem
                  key={navKey(node)}
                  node={node}
                  pathname={pathname}
                  depth={0}
                  collapsed={collapsed}
                  onExpandSidebar={onExpandSidebar}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-border">
        {showSubscription && !collapsed ? (
          <div className="px-2 pt-2.5">
            <Link
              href="/beallitasok/elofizetes"
              onClick={onNavigate}
              className={cn(
                'group relative flex h-8 items-center gap-2 rounded-md px-2 no-underline transition-colors duration-fast',
                subscriptionActive
                  ? cn(subscriptionAccent.soft, subscriptionAccent.ink)
                  : 'text-ink-secondary hover:bg-subtle hover:text-ink'
              )}
              aria-current={subscriptionActive ? 'page' : undefined}
            >
              {subscriptionActive ? (
                <span
                  className={cn(
                    'absolute left-0 top-1 bottom-1 w-1 rounded-r-sm',
                    subscriptionAccent.bar
                  )}
                  aria-hidden
                />
              ) : null}
              <CreditCard
                className={cn(
                  'size-4 shrink-0',
                  subscriptionActive
                    ? subscriptionAccent.icon
                    : subscriptionAccent.iconMuted
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'truncate text-[13px]',
                  subscriptionActive ? 'font-semibold' : 'font-medium'
                )}
              >
                Előfizetés
              </span>
            </Link>
          </div>
        ) : null}

        {showSubscription && collapsed ? (
          <div className="flex justify-center px-1.5 pt-2">
            <Link
              href="/beallitasok/elofizetes"
              title="Előfizetés"
              className={cn(
                'flex size-8 items-center justify-center rounded-md transition-colors duration-fast',
                subscriptionActive
                  ? cn(subscriptionAccent.soft, subscriptionAccent.ink)
                  : 'text-ink-secondary hover:bg-subtle hover:text-ink'
              )}
              aria-label="Előfizetés"
              aria-current={subscriptionActive ? 'page' : undefined}
            >
              <CreditCard className="size-4" aria-hidden />
            </Link>
          </div>
        ) : null}

        {!collapsed ? (
          <div className="px-0 py-1.5">
            <AppLegalLinks variant="sidebar" />
          </div>
        ) : null}

        {showCollapse ? (
          <div
            className={cn(
              'border-t border-border p-2',
              collapsed && 'flex justify-center'
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(collapsed ? 'size-8 p-0' : 'w-full justify-start')}
              onClick={() => onCollapsedChange(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={
                collapsed ? 'Oldalsáv kinyitása' : 'Oldalsáv összecsukása'
              }
              title={collapsed ? 'Kinyitás' : 'Összecsukás'}
            >
              {collapsed ? (
                <PanelLeft className="size-4" aria-hidden />
              ) : (
                <>
                  <PanelLeftClose className="size-4" aria-hidden />
                  <span>Összecsukás</span>
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}

function navKey(node: NavNode) {
  return isNavLink(node) ? node.href : node.matchPrefix
}

function iconSize(depth: number) {
  if (depth === 0) return 'size-4'
  return 'size-3.5'
}

function NavNodeItem({
  node,
  pathname,
  depth,
  collapsed,
  onExpandSidebar,
  onNavigate
}: {
  node: NavNode
  pathname: string
  depth: number
  collapsed: boolean
  onExpandSidebar: () => void
  onNavigate?: () => void
}) {
  if (isNavLink(node)) {
    return (
      <NavLinkItem
        item={node}
        pathname={pathname}
        depth={depth}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    )
  }
  return (
    <NavGroupItem
      group={node}
      pathname={pathname}
      depth={depth}
      collapsed={collapsed}
      onExpandSidebar={onExpandSidebar}
      onNavigate={onNavigate}
    />
  )
}

function NavLinkItem({
  item,
  pathname,
  depth,
  collapsed,
  onNavigate
}: {
  item: NavLink
  pathname: string
  depth: number
  collapsed: boolean
  onNavigate?: () => void
}) {
  const active = pathIsActive(pathname, item.href)
  const Icon = item.icon
  const accent = getNavAccentClasses(item.accent)

  if (collapsed && depth > 0) return null

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        'group relative flex min-h-10 items-center rounded-md no-underline transition-colors duration-fast md:h-8 md:min-h-0',
        collapsed
          ? 'justify-center px-0'
          : cn(
              'gap-2',
              depth === 0 && 'px-2',
              depth === 1 && 'pl-4 pr-2',
              depth >= 2 && 'pl-7 pr-2'
            ),
        active
          ? cn(accent.soft, accent.ink)
          : 'text-ink-secondary hover:bg-subtle hover:text-ink'
      )}
      aria-current={active ? 'page' : undefined}
    >
      {active && !collapsed ? (
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
          'shrink-0',
          iconSize(depth),
          active ? accent.icon : accent.iconMuted,
          !active && 'opacity-90'
        )}
        aria-hidden
      />
      {!collapsed ? (
        <span
          className={cn(
            'truncate text-[13px]',
            active ? 'font-semibold' : 'font-medium'
          )}
        >
          {item.label}
        </span>
      ) : (
        <span className="sr-only">{item.label}</span>
      )}
    </Link>
  )
}

function NavGroupItem({
  group,
  pathname,
  depth,
  collapsed,
  onExpandSidebar,
  onNavigate
}: {
  group: NavGroup
  pathname: string
  depth: number
  collapsed: boolean
  onExpandSidebar: () => void
  onNavigate?: () => void
}) {
  const inSection = navGroupIsActive(group, pathname)
  const [open, setOpen] = useState(inSection)
  const Icon = group.icon
  const accent = getNavAccentClasses(group.accent)

  useEffect(() => {
    setOpen(inSection)
  }, [inSection, pathname])

  if (collapsed) {
    return (
      <button
        type="button"
        title={group.label}
        onClick={() => {
          onExpandSidebar()
          setOpen(true)
        }}
        className={cn(
          'flex h-8 w-full items-center justify-center rounded-md transition-colors duration-fast',
          inSection
            ? cn(accent.soft, accent.ink)
            : 'text-ink-secondary hover:bg-subtle hover:text-ink'
        )}
        aria-label={`${group.label} megnyitása`}
      >
        <Icon
          className={cn(
            'size-4 shrink-0',
            inSection ? accent.icon : accent.iconMuted
          )}
          aria-hidden
        />
        <span className="sr-only">{group.label}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex min-h-10 w-full items-center gap-2 rounded-md text-left transition-colors duration-fast md:h-8 md:min-h-0',
          depth === 0 && 'px-2',
          depth === 1 && 'pl-4 pr-2',
          depth >= 2 && 'pl-7 pr-2',
          /* Child aktív → nincs soft háttér / bal sáv a group headeren */
          inSection
            ? cn(accent.ink, 'hover:bg-subtle')
            : 'text-ink-secondary hover:bg-subtle hover:text-ink'
        )}
        aria-expanded={open}
      >
        <Icon
          className={cn(
            'shrink-0',
            iconSize(depth),
            inSection ? accent.icon : accent.iconMuted,
            !inSection && 'opacity-90'
          )}
          aria-hidden
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px]',
            inSection ? 'font-semibold' : 'font-medium'
          )}
        >
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-ink-muted transition-transform duration-fast',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {group.children.map((child) => (
            <NavNodeItem
              key={navKey(child)}
              node={child}
              pathname={pathname}
              depth={depth + 1}
              collapsed={false}
              onExpandSidebar={onExpandSidebar}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Topbar gomb — csak <md. */
export function MobileNavMenuButton({
  onClick
}: {
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-10 shrink-0 p-0 md:hidden"
      aria-label="Menü megnyitása"
      onClick={onClick}
    >
      <Menu className="size-5" aria-hidden />
    </Button>
  )
}
