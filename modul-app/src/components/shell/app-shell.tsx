'use client'

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
  const { collapsed, setCollapsed } = useSidebarCollapsed()

  return (
    <div className="relative min-h-screen bg-app">
      <AppSidebar
        allowedPages={user.allowedPages}
        showSubscription={user.role === 'owner'}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
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
        <AppTopbar user={user} />
        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
