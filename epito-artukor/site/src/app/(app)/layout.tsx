import { AppSidebar } from "@/components/shell/app-sidebar"
import { PageAccentProvider } from "@/components/shell/page-accent-provider"
import { TradesProvider } from "@/components/trades/trades-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TradesProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6">
            <PageAccentProvider>{children}</PageAccentProvider>
          </div>
        </main>
      </div>
    </TradesProvider>
  )
}
