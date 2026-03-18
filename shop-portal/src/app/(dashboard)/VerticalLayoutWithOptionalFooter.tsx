'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import VerticalLayout from '@layouts/VerticalLayout'
import Navigation from '@components/layout/vertical/Navigation'
import Navbar from '@components/layout/vertical/Navbar'
import VerticalFooter from '@components/layout/vertical/Footer'

export default function VerticalLayoutWithOptionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const isPackOrderPage = pathname.match(/^\/pack\/orders\/[^/]+$/)
  return (
    <VerticalLayout
      navigation={<Navigation />}
      navbar={<Navbar />}
      footer={isPackOrderPage ? null : <VerticalFooter />}
    >
      {children}
    </VerticalLayout>
  )
}
