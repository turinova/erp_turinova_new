import { notFound } from 'next/navigation'

import { WEBSHOP_ENABLED } from '@/lib/webshop/enabled'

export default function WebshopLayout({ children }: { children: React.ReactNode }) {
  if (!WEBSHOP_ENABLED) notFound()
  return children
}
