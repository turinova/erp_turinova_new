import '@/components/landing-v2/landing-v2.css'
import Navbar from '@/components/landing-v2/Navbar'
import Footer from '@/components/landing-v2/Footer'

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="lv2-root min-h-screen bg-white flex flex-col"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}

