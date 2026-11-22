export default function KioskLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-[100dvh] bg-app antialiased">{children}</div>
}
