'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

import { logoutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/session'
import { getPlatformPublicOrigin } from '@/lib/auth/surface'
import { pathIsAllowed } from '@/lib/permissions/pages'
import { Button } from '@/components/ui/button'
import { MobileNavMenuButton } from '@/components/shell/app-sidebar'
import { TopbarDate } from '@/components/shell/topbar-date'
import { TopbarGoogleRating } from '@/components/shell/topbar-google-rating'
import type { TopbarGoogleRating as TopbarGoogleRatingData } from '@/lib/reviews/google-rating'

type AppTopbarProps = {
  user: SessionUser
  googleRating?: TopbarGoogleRatingData | null
  onOpenMobileNav?: () => void
}

function initialsFromLabel(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  const local = label.split('@')[0] || '?'
  const chunks = local.split(/[._-]/).filter(Boolean)
  if (chunks.length >= 2) {
    return `${chunks[0]![0] ?? ''}${chunks[1]![0] ?? ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function AppTopbar({ user, googleRating = null, onOpenMobileNav }: AppTopbarProps) {
  const showPlatform = user.isPlatformAdmin || user.isDevSession
  const platformOrigin = getPlatformPublicOrigin()
  const platformHref = platformOrigin ? `${platformOrigin}/` : '/platform'
  const label = user.displayName?.trim() || user.email

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-border bg-surface px-3 md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {onOpenMobileNav ? (
          <MobileNavMenuButton onClick={onOpenMobileNav} />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">
            {user.companyName}
          </p>
          <p className="truncate text-hint text-ink-secondary">
            {user.isDevSession
              ? 'Fejlesztői belépés'
              : user.roleLabel
                ? user.roleLabel
                : user.tenantSlug
                  ? `/${user.tenantSlug}`
                  : null}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {googleRating && user.tenantId ? (
          <>
            <TopbarGoogleRating
              data={googleRating}
              tenantId={user.tenantId}
              canManage={pathIsAllowed('/beallitasok/google-ertekelesek', user.allowedPages)}
            />
            <span className="h-5 w-px bg-border" aria-hidden />
          </>
        ) : null}
        <TopbarDate />
        <span className="h-5 w-px bg-border" aria-hidden />
        {showPlatform ? (
          <Link
            href={platformHref}
            className="hidden rounded-md px-2 py-1 text-[12.5px] font-medium text-ink-secondary no-underline hover:bg-subtle hover:text-ink sm:inline"
          >
            Platform
          </Link>
        ) : null}

        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-subtle [&::-webkit-details-marker]:hidden">
            <span
              className="flex size-6 items-center justify-center rounded-full border border-border bg-subtle text-[10px] font-semibold text-ink"
              aria-hidden
            >
              {initialsFromLabel(label)}
            </span>
            <span className="hidden max-w-[160px] truncate text-[12.5px] text-ink-secondary sm:inline">
              {label}
            </span>
            <ChevronDown className="size-3.5 text-ink-secondary" aria-hidden />
          </summary>
          <div className="absolute right-0 mt-1 w-52 rounded-md border border-border bg-surface p-1 shadow-elev2">
            <p className="truncate px-2.5 py-1.5 text-hint text-ink-secondary">
              {user.email}
            </p>
            {user.tenantSlug ? (
              <p className="truncate px-2.5 pb-1.5 text-hint text-ink-muted">
                Tenant: {user.tenantSlug}
              </p>
            ) : null}
            <Link
              href="/beallitasok/profil"
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-ink no-underline hover:bg-subtle"
            >
              Saját adatok
            </Link>
            {showPlatform ? (
              <Link
                href={platformHref}
                className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-ink no-underline hover:bg-subtle"
              >
                Platform konzol
              </Link>
            ) : null}
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
              >
                Kijelentkezés
              </Button>
            </form>
          </div>
        </details>
      </div>
    </header>
  )
}
