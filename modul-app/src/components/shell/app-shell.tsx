'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppTopbar } from '@/components/shell/app-topbar'
import { ImpersonationBanner } from '@/components/shell/impersonation-banner'
import { useSidebarCollapsed } from '@/components/shell/use-sidebar-collapsed'
import type { SessionUser } from '@/lib/auth/session'
import { cn } from '@/lib/utils'

type AppShellProps = {
  user: SessionUser
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebarCollapsed()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isPos = pathname === '/pos' || pathname.startsWith('/pos/')
  /** PDA fill: no main pad so client can use 100dvh − topbar. */
  const isOpeningStock = pathname === '/keszlet/nyito'

  if (isPos) {
    return (
      <div className="relative min-h-screen bg-app">
        {user.impersonation ? (
          <ImpersonationBanner info={user.impersonation} />
        ) : null}
        {children}
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-app">
      <AppSidebar
        allowedPages={user.allowedPages}
        showSubscription={user.role === 'owner'}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div
        className={cn(
          'transition-[margin] duration-fast ease-flat',
          collapsed
            ? 'md:ml-[var(--sidebar-collapsed-width)]'
            : 'md:ml-[var(--sidebar-width)]'
        )}
      >
        {user.impersonation ? (
          <ImpersonationBanner info={user.impersonation} />
        ) : null}
        <AppTopbar
          user={user}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main
          className={cn(
            isOpeningStock
              ? 'overflow-hidden px-0 pb-0 pt-0'
              : 'px-4 pb-6 pt-4 md:px-6'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
