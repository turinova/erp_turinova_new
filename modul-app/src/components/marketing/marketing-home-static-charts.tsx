'use client'

import { HomeSalesSparkChart } from '@/components/home/home-sales-spark-chart'
import type { SalesDayPoint } from '@/lib/home/kpi-queries'

/** Marketing: éles sales spark fixture-rel — nincs fetch. */

export function MarketingSalesSpark({
  data,
  height,
  gradientId
}: {
  data: SalesDayPoint[]
  height?: number
  gradientId?: string
}) {
  return (
    <HomeSalesSparkChart
      data={data}
      metric="gross"
      height={height}
      gradientId={gradientId}
      showTooltip={height != null && height < 40 ? false : true}
      strokeWidth={height != null && height < 40 ? 1.25 : 1.5}
    />
  )
}
