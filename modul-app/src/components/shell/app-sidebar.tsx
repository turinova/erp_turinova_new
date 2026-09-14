'use client'

import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  isNavLink,
  mainNavItems,
  pathIsActive,
  pathMatchesPrefix,
  type NavGroup,
  type NavLink,
  type NavNode
} from '@/lib/navigation'
import { filterNavByAccess } from '@/lib/permissions/filter-nav'
import { cn } from '@/lib/utils'

export function AppSidebar({ allowedPages }: { allowedPages: string[] }) {
  const pathname = usePathname()
  const navItems = filterNavByAccess(mainNavItems, allowedPages)

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-surface md:flex"
      aria-label="Oldalsáv"
    >
      <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
        <Link
          href="/home"
          className="flex items-center no-underline"
          aria-label="Optinova kezdőlap"
        >
          <Image
            src="/images/optinova-logo.png"
            alt="Optinova"
            width={140}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>
      </div>

      <nav
        className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4"
        aria-label="Főmenü"
      >
        {navItems.map((node) => (
          <NavNodeItem
            key={navKey(node)}
            node={node}
            pathname={pathname}
            depth={0}
          />
        ))}
      </nav>
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
  depth
}: {
  node: NavNode
  pathname: string
  depth: number
}) {
  if (isNavLink(node)) {
    return <NavLinkItem item={node} pathname={pathname} depth={depth} />
  }
  return <NavGroupItem group={node} pathname={pathname} depth={depth} />
}

function NavLinkItem({
  item,
  pathname,
  depth
}: {
  item: NavLink
  pathname: string
  depth: number
}) {
  const active = pathIsActive(pathname, item.href)
  const Icon = item.icon
  const accent = getNavAccentClasses(item.accent)

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex h-8 items-center gap-2 rounded-md no-underline transition-colors duration-fast',
        depth === 0 && 'px-2',
        depth === 1 && 'pl-4 pr-2',
        depth >= 2 && 'pl-7 pr-2',
        active
          ? cn(accent.soft, accent.ink)
          : 'text-ink-secondary hover:bg-subtle hover:text-ink'
      )}
      aria-current={active ? 'page' : undefined}
    >
      {active ? (
        <span
          className={cn(
            'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm',
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
          !active && 'group-hover:opacity-100'
        )}
        aria-hidden
      />
      <span className="truncate text-[13px] font-medium">{item.label}</span>
    </Link>
  )
}

function NavGroupItem({
  group,
  pathname,
  depth
}: {
  group: NavGroup
  pathname: string
  depth: number
}) {
  const inSection = pathMatchesPrefix(pathname, group.matchPrefix)
  const [open, setOpen] = useState(inSection)
  const Icon = group.icon
  const accent = getNavAccentClasses(group.accent)

  useEffect(() => {
    if (inSection) setOpen(true)
  }, [inSection])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md text-left transition-colors duration-fast',
          depth === 0 && 'px-2',
          depth === 1 && 'pl-4 pr-2',
          depth >= 2 && 'pl-7 pr-2',
          inSection
            ? 'text-ink'
            : 'text-ink-secondary hover:bg-subtle hover:text-ink'
        )}
        aria-expanded={open}
      >
        <Icon
          className={cn(
            'shrink-0',
            iconSize(depth),
            inSection ? accent.icon : accent.iconMuted
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
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
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
