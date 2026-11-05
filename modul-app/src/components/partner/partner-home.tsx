import Link from 'next/link'

import { ArchiveBanner } from '@/components/partner/home/archive-banner'
import { ContactCard } from '@/components/partner/home/contact-card'
import { HomeFaq } from '@/components/partner/home/home-faq'
import {
  HomeTiles,
  SelectCompanyCard
} from '@/components/partner/home/home-tiles'
import { HowItWorks } from '@/components/partner/home/how-it-works'
import { RecentOrdersCard } from '@/components/partner/home/recent-orders-card'
import type { OpenStatus } from '@/lib/opening-hours'
import type { PartnerHomeData } from '@/lib/partner/home-queries'

type HrefBag = {
  settings: string
  search: string
  opti: string
  quotes: string
  orders: string
}

type Props = {
  greeting: string
  selectedTenantId: string | null
  data: PartnerHomeData
  openStatus: OpenStatus | null
  archiveVisible: boolean
  hrefs: HrefBag
}

export function PartnerHome({
  greeting,
  selectedTenantId,
  data,
  openStatus,
  archiveVisible,
  hrefs
}: Props) {
  const hasTenant = Boolean(selectedTenantId)

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-8">
      {archiveVisible ? <ArchiveBanner /> : null}

      <header>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {greeting}
        </h1>
        {data.companyLabel ? (
          <p className="mt-1 text-[15px] text-ink-secondary">
            {data.companyLabel}
            <span className="mx-1.5 text-ink-muted" aria-hidden>
              ·
            </span>
            <Link
              href={hrefs.settings}
              className="text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
            >
              Cég váltása
            </Link>
          </p>
        ) : null}
      </header>

      {hasTenant ? (
        <HomeTiles
          hrefs={hrefs}
          draftCount={data.draftCount}
          openOrderCount={data.openOrderCount}
          acceptsOrders={data.acceptsOrders}
          phone={data.contact?.phone ?? null}
        />
      ) : (
        <SelectCompanyCard settingsHref={hrefs.settings} />
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {hasTenant ? (
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <ContactCard
              companyName={data.companyName}
              contact={data.contact}
              openingHours={data.openingHours}
              openingHoursNote={data.openingHoursNote}
              status={openStatus}
            />
          </div>
        ) : null}

        <div
          className={
            hasTenant
              ? 'space-y-6 lg:col-span-8 lg:col-start-1 lg:row-start-1'
              : 'space-y-6 lg:col-span-12'
          }
        >
          <RecentOrdersCard
            rows={data.recentOrders}
            total={data.submittedCount}
            ordersHref={hrefs.orders}
            selectedTenantId={selectedTenantId}
          />
          <HowItWorks hrefs={hrefs} defaultOpen={data.submittedCount === 0} />
          <HomeFaq hrefs={hrefs} archiveVisible={archiveVisible} />
        </div>
      </div>
    </div>
  )
}
