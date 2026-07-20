import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import HomeClient from './HomeClient'
import {
  getCustomerPortalDraftQuotes,
  getCustomerPortalNettfrontDraftQuotes
} from '@/lib/supabase-server'
import {
  getMonthlyQuotesData,
  getMonthlySupplierOrdersData,
  getWeeklyCuttingData,
  getWeeklyEdgeBandingData,
  getTodayAttendanceForHome,
  getPosOrdersGoalStats
} from '@/lib/dashboard-server'
import { getFootcounterDashboardStats, slimFootcounterForHome } from '@/lib/footcounter-stats'
import type { FootcounterHomeSlim } from '@/types/footcounter'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const loadFootcounterHome = async (): Promise<FootcounterHomeSlim | null> => {
    if (!user) return null
    try {
      const slug = process.env.FOOTCOUNTER_STATS_DEVICE_SLUG?.trim() || 'default'
      const stats = await getFootcounterDashboardStats(slug)
      return slimFootcounterForHome(stats)
    } catch {
      return null
    }
  }

  const [
    customerPortalQuotes,
    customerPortalNettfrontQuotes,
    monthlyQuotes,
    monthlySupplierOrders,
    weeklyCutting,
    weeklyEdgeBanding,
    todayAttendance,
    posOrdersGoalStats,
    footcounterHome
  ] = await Promise.all([
    getCustomerPortalDraftQuotes(),
    getCustomerPortalNettfrontDraftQuotes(),
    getMonthlyQuotesData('month', 0),
    getMonthlySupplierOrdersData('month', 0),
    getWeeklyCuttingData(0),
    getWeeklyEdgeBandingData(0),
    getTodayAttendanceForHome(),
    getPosOrdersGoalStats(),
    loadFootcounterHome()
  ])

  return (
    <HomeClient
      customerPortalQuotes={customerPortalQuotes}
      customerPortalNettfrontQuotes={customerPortalNettfrontQuotes}
      initialMonthlyQuotes={monthlyQuotes}
      initialMonthlySupplierOrders={monthlySupplierOrders}
      initialWeeklyCutting={weeklyCutting}
      initialWeeklyEdgeBanding={weeklyEdgeBanding}
      initialTodayAttendance={todayAttendance}
      posOrdersGoalStats={posOrdersGoalStats}
      footcounterHome={footcounterHome}
    />
  )
}
