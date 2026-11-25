import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { CustomerOrderStatusShell } from '@/components/order-status/customer-order-status-shell'
import { loadCustomerOrderStatusByToken, loadInvalidOrderLink } from '@/lib/order-status/load'
import { recordOrderShareOpenByToken } from '@/lib/order-status/record-open'

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
    const invalid = await loadInvalidOrderLink(token).catch(() => null)
    const phone = invalid?.company.phone ?? null
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-4">
        <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-4 py-8 text-center">
          {invalid ? (
            <p className="text-body font-semibold text-ink">{invalid.company.name}</p>
          ) : null}
          <p className="mt-1 text-[18px] font-semibold text-ink">
            {invalid?.reason === 'closed' ? 'Ez a rendelés lezárult' : 'A link nem érvényes'}
          </p>
          <p className="mt-2 text-body text-ink-secondary">
            {invalid?.reason === 'closed'
              ? 'A rendelést lezártuk vagy lemondták. Ha kérdésed van, hívj minket.'
              : invalid
                ? 'Ez a link lejárt. Hívj minket, és megmondjuk, hol tart a rendelésed.'
                : 'Lehet, hogy lejárt, vagy elírták. Ha kérdésed van, hívd a boltot / műhelyt, ahol a rendelést feladtad.'}
          </p>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-ink text-body font-medium text-white"
            >
              Hívás · {phone}
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  const requestHeaders = await headers()
  after(() => {
    void recordOrderShareOpenByToken(token, requestHeaders)
  })

  return <CustomerOrderStatusShell view={view} />
}
