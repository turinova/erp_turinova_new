import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StorefrontCartView } from '@/components/storefront/cart-view'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { getStorefrontShell } from '@/lib/storefront/shell'

type PageProps = { params: Promise<{ site: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shell = await getStorefrontShell((await params).site)
  return {
    title: { absolute: `Kosár · ${shell?.seller.name ?? 'Bolt'}` },
    robots: { index: false, follow: false }
  }
}

export default async function StorefrontCartPage({ params }: PageProps) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) notFound()
  const { seller, settings, categories } = shell

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
        <h1 className="mb-4 text-[20px] font-semibold tracking-[-0.01em] text-ink">Kosár</h1>
        <StorefrontCartView
          sellerName={seller.name}
          sellerEmail={seller.email}
          sellerPhone={seller.phone}
          shippingFeeGross={settings.shippingFeeGross}
          freeShippingThresholdGross={settings.freeShippingThresholdGross}
        />
      </main>
    </StorefrontFrame>
  )
}
