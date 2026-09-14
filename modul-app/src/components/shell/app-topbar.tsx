import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

import { logoutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/session'
import { getPlatformPublicOrigin } from '@/lib/auth/surface'
import { Button } from '@/components/ui/button'

type AppTopbarProps = {
  user: SessionUser
}

function initialsFromEmail(email: string) {
  const local = email.split('@')[0] || '?'
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function AppTopbar({ user }: AppTopbarProps) {
  const showPlatform = user.isPlatformAdmin || user.isDevSession
  const platformOrigin = getPlatformPublicOrigin()
  const platformHref = platformOrigin ? `${platformOrigin}/` : '/platform'

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-5">
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

      <div className="flex items-center gap-2">
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
              {initialsFromEmail(user.email)}
            </span>
            <span className="hidden max-w-[160px] truncate text-[12.5px] text-ink-secondary sm:inline">
              {user.email}
            </span>
            <ChevronDown className="size-3.5 text-ink-secondary" aria-hidden />
          </summary>
          <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-elev2">
            <p className="truncate px-2.5 py-1.5 text-hint text-ink-secondary">
              {user.email}
            </p>
            {user.tenantSlug ? (
              <p className="truncate px-2.5 pb-1.5 text-hint text-ink-muted">
                Tenant: {user.tenantSlug}
              </p>
            ) : null}
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
