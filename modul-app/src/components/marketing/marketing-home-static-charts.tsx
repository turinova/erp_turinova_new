'use client'

import { HomeSalesSparkChart } from '@/components/home/home-sales-spark-chart'
import type { SalesDayPoint } from '@/lib/home/kpi-queries'

/** Marketing: éles sales spark fixture-rel — nincs fetch. */

export function MarketingSalesSpark({ data }: { data: SalesDayPoint[] }) {
  return <HomeSalesSparkChart data={data} metric="gross" />
}
