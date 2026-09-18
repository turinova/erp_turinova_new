'use client'

import { ChevronDown, CreditCard, PanelLeftClose, PanelLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppLegalLinks } from '@/components/shell/app-legal-links'
import { Button } from '@/components/ui/button'
import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  isNavLink,
  mainNavItems,
  navGroupIsActive,
  pathIsActive,
  type NavGroup,
  type NavLink,
  type NavNode
} from '@/lib/navigation'
import { filterNavByAccess } from '@/lib/permissions/filter-nav'
import { cn } from '@/lib/utils'

type AppSidebarProps = {
  allowedPages: string[]
  /** Csak tenant owner látja az Előfizetés linket. */
  showSubscription: boolean
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function AppSidebar({
  allowedPages,
  showSubscription,
  collapsed,
  onCollapsedChange
}: AppSidebarProps) {
  const pathname = usePathname()
  const navItems = filterNavByAccess(mainNavItems, allowedPages)
  const subscriptionActive = pathIsActive(pathname, '/beallitasok/elofizetes')
  const subscriptionAccent = getNavAccentClasses('slate')

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-fast ease-flat md:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
      aria-label="Oldalsáv"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center px-1.5' : 'px-3'
        )}
      >
        <Link
          href="/home"
          className="flex items-center no-underline"
          aria-label="Optinova kezdőlap"
        >
          {collapsed ? (
            <Image
              src="/images/turinova-small-icon.png"
              alt=""
              width={32}
              height={32}
              className="size-8 object-contain"
              priority
            />
          ) : (
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={140}
              height={28}
              className="h-7 w-auto"
              priority
            />
          )}
        </Link>
      </div>

      <nav
        className={cn(
          'mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2',
          collapsed ? 'px-1.5' : 'px-2'
        )}
        aria-label="Főmenü"
      >
        {navItems.map((node) => (
          <NavNodeItem
            key={navKey(node)}
            node={node}
            pathname={pathname}
            depth={0}
            collapsed={collapsed}
            onExpandSidebar={() => onCollapsedChange(false)}
          />
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-border">
        {showSubscription && !collapsed ? (
          <div className="px-2 pt-2.5">
            <Link
              href="/beallitasok/elofizetes"
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
      </div>
    </aside>
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
  onExpandSidebar
}: {
  node: NavNode
  pathname: string
  depth: number
  collapsed: boolean
  onExpandSidebar: () => void
}) {
  if (isNavLink(node)) {
    return (
      <NavLinkItem
        item={node}
        pathname={pathname}
        depth={depth}
        collapsed={collapsed}
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
    />
  )
}

function NavLinkItem({
  item,
  pathname,
  depth,
  collapsed
}: {
  item: NavLink
  pathname: string
  depth: number
  collapsed: boolean
}) {
  const active = pathIsActive(pathname, item.href)
  const Icon = item.icon
  const accent = getNavAccentClasses(item.accent)

  if (collapsed && depth > 0) return null

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex h-8 items-center rounded-md no-underline transition-colors duration-fast',
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
          active ? accent.icon : accent.iconMuted
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
  onExpandSidebar
}: {
  group: NavGroup
  pathname: string
  depth: number
  collapsed: boolean
  onExpandSidebar: () => void
}) {
  const inSection = navGroupIsActive(group, pathname)
  const [open, setOpen] = useState(inSection)
  const Icon = group.icon
  const accent = getNavAccentClasses(group.accent)

  // Accordion: aktív szekció nyitva; elnavigáláskor a többi becsukódik.
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
          'relative flex h-8 w-full items-center gap-2 rounded-md text-left transition-colors duration-fast',
          depth === 0 && 'px-2',
          depth === 1 && 'pl-4 pr-2',
          depth >= 2 && 'pl-7 pr-2',
          inSection
            ? cn(accent.soft, accent.ink)
            : 'text-ink-secondary hover:bg-subtle hover:text-ink'
        )}
        aria-expanded={open}
      >
        {inSection ? (
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
            inSection ? accent.icon : accent.iconMuted
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
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
