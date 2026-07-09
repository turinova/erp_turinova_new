import { SettingsSubNav } from "@/components/beallitasok/settings-sub-nav"

export default function BeallitasokLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsSubNav />
      {children}
    </div>
  )
}
