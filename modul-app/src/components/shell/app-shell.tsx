import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppTopbar } from '@/components/shell/app-topbar'
import type { SessionUser } from '@/lib/auth/session'

type AppShellProps = {
  user: SessionUser
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-app">
      <AppSidebar allowedPages={user.allowedPages} />
      <div className="md:ml-[var(--sidebar-width)]">
        <AppTopbar user={user} />
        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
