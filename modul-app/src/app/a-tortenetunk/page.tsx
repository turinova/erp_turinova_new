import type { Metadata } from 'next'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  formatHufNet,
  formatHufPlain
} from '@/lib/marketing/pricing'
import {
  computeRoi,
  formatHoursHu,
  formatMonthsHu,
  HIROS_ROI_INPUTS
} from '@/lib/marketing/roi'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'A történetünk',
  description:
    'Hírös Ablak: hogyan lett az Optinova a mindennapi ajánlat és műhely része — számokkal.'
}

export default function OurStoryPage() {
  const result = computeRoi(HIROS_ROI_INPUTS)

  return (
    <MarketingShell activeHref="/a-tortenetunk">
      <article>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
              A történetünk
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
              Először magunknak építettük
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-secondary">
              Ablakos gyártóként indultunk — Hírös Ablak, Kecskemét. Az Optinova
              nem demóprojekt: a napi ajánlat, gyártásszervezés és
              ügyfélértesítés része. A számok ugyanabból a képletből jönnek, mint
              a nyilvános megtérülés-kalkulátor.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
          <section>
            <h2 className="text-[17px] font-semibold text-ink">A helyzet</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
              Havonta több tucat ajánlat, gyakori ár- és anyagváltozás, SMS és
              partner-egyeztetés kézzel. Az idő nem „adminisztráció” — a műhely
              és az ügyfél várakozása.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-ink">
              Előtte / utána (modellinputok)
            </h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[320px] text-left text-[13px]">
                <thead className="border-b border-border bg-subtle text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Tétel</th>
                    <th className="px-3 py-2 font-medium">Előtte</th>
                    <th className="px-3 py-2 font-medium">Optinovával</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">Ajánlat / hó</td>
                    <td className="px-3 py-2 tabular-nums" colSpan={2}>
                      {HIROS_ROI_INPUTS.quotesPerMonth}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">Perc / ajánlat</td>
                    <td className="px-3 py-2 tabular-nums">
                      {HIROS_ROI_INPUTS.minutesPerQuoteNow}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {HIROS_ROI_INPUTS.minutesPerQuoteWithOptinova}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">Gyártás szervezés óra / hét</td>
                    <td className="px-3 py-2 tabular-nums">
                      {HIROS_ROI_INPUTS.productionHoursPerWeekNow}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {HIROS_ROI_INPUTS.productionHoursPerWeekWithOptinova}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">SMS / hó</td>
                    <td className="px-3 py-2 tabular-nums" colSpan={2}>
                      {HIROS_ROI_INPUTS.smsPerMonth} ·{' '}
                      {HIROS_ROI_INPUTS.minutesPerSmsManual} perc/db kézzel
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">
              Órabér a modellben:{' '}
              {formatHufPlain(HIROS_ROI_INPUTS.hourlyWageHuf)}/óra (teljes
              bérköltség). Modulok: Alap + SMS + Online partner + Címke.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-ink">Eredmény</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat
                label="Megspórolt idő / hó"
                value={formatHoursHu(result.hoursTotal)}
              />
              <Stat
                label="Megspórolt érték / hó"
                value={formatHufPlain(result.savingsMonthlyHuf)}
              />
              <Stat
                label="Előfizetés (becslés)"
                value={formatHufNet(result.subscriptionMonthlyHuf)}
              />
              <Stat
                label="Nettó nyereség / hó"
                value={formatHufPlain(result.netMonthlyHuf)}
              />
              <Stat
                label="Megtérülés"
                value={
                  result.paybackMonths != null
                    ? formatMonthsHu(result.paybackMonths)
                    : '—'
                }
              />
              <Stat
                label="Éves spórolás (időérték)"
                value={formatHufPlain(result.savingsYearlyHuf)}
              />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">
              Bontás: ajánlat {formatHoursHu(result.hoursQuotes)}, gyártás{' '}
              {formatHoursHu(result.hoursProduction)}, SMS{' '}
              {formatHoursHu(result.hoursSms)} havonta. Ez becslés a publikált
              képlettel — nem szerződéses garancia.
            </p>
          </section>

          <blockquote className="rounded-lg border border-border bg-subtle px-4 py-4 text-[14px] leading-relaxed text-ink">
            „Nem az volt a cél, hogy „legyen szoftver”, hanem hogy az ajánlat és
            a műhely ne vigyen el fél napot. A kalkulátor ugyanazt mutatja, amit
            a mindennapokban érzünk.”
            <footer className="mt-3 text-[12px] text-ink-muted">
              — Hírös Ablak, üzemeltetés
            </footer>
          </blockquote>

          <div className="flex flex-wrap gap-3 border-t border-border pt-8">
            <Link
              href="/kapcsolat"
              className={cn(
                buttonVariants({ variant: 'primary', size: 'md' }),
                'no-underline'
              )}
            >
              Ingyenes konzultáció
            </Link>
            <Link
              href="/hogyan-mukodik"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'no-underline'
              )}
            >
              Hogyan működik
            </Link>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  )
}
