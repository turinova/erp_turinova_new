import type { Metadata } from 'next'

import { CustomerOrderStatusShell } from '@/components/order-status/customer-order-status-shell'
import { loadCustomerOrderStatusByToken } from '@/lib/order-status/load'

type Params = Promise<{ token: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { token } = await params
  const view = await loadCustomerOrderStatusByToken(token).catch(() => null)
  if (!view) {
    return {
      title: 'Rendelés',
      robots: { index: false, follow: false }
    }
  }
  return {
    title: `${view.orderNumber} · ${view.company.name}`,
    description: view.statusBody,
    robots: { index: false, follow: false }
  }
}

export default async function OrderStatusPage({
  params
}: {
  params: Params
}) {
  const { token } = await params
  const view = await loadCustomerOrderStatusByToken(token).catch(() => null)

  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-4">
        <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[18px] font-semibold text-ink">
            A link nem érvényes
          </p>
          <p className="mt-2 text-body text-ink-secondary">
            Lehet, hogy lejárt, vagy elírták. Ha kérdésed van, hívd a boltot /
            műhelyt, ahol a rendelést feladtad.
          </p>
        </div>
      </div>
    )
  }

  return <CustomerOrderStatusShell view={view} />
}
