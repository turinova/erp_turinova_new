'use client'

import React from 'react'
import { Container, Grid } from '@mui/material'
import HomeNewsCard from '@/components/HomeNewsCard'
import CustomerPortalQuotesTable from '@/components/CustomerPortalQuotesTable'
import CustomerPortalNettfrontQuotesTable from '@/components/CustomerPortalNettfrontQuotesTable'
import TodayAttendanceDashboard, { type TodayAttendanceEmployee } from '@/components/TodayAttendanceDashboard'
import WeeklyCuttingChart from '@/components/WeeklyCuttingChart'
import WeeklyEdgeBandingChart from '@/components/WeeklyEdgeBandingChart'
import BacklogTotalsCard from '@/components/BacklogTotalsCard'
import MonthlyQuotesCard from '@/components/MonthlyQuotesCard'
import MonthlySupplierOrdersCard from '@/components/MonthlySupplierOrdersCard'
import PosOrdersGoalsCard from '@/components/PosOrdersGoalsCard'
import FootcounterHomeCard from '@/components/FootcounterHomeCard'
import type { PosOrdersGoalStats } from '@/lib/dashboard-server'
import type { FootcounterHomeSlim } from '@/types/footcounter'
import type { HomeNewsPost } from '@/lib/home-news-server'

interface CustomerQuote {
  id: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface NettfrontPortalQuote {
  id: string
  quote_number?: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface HomeClientProps {
  homeNewsPosts: HomeNewsPost[]
  customerPortalQuotes: CustomerQuote[]
  customerPortalNettfrontQuotes: NettfrontPortalQuote[]
  initialMonthlyQuotes: any
  initialMonthlySupplierOrders: any
  initialWeeklyCutting: any
  initialWeeklyEdgeBanding: any
  initialTodayAttendance: {
    dateLabel: string
    employees: TodayAttendanceEmployee[]
  }
  posOrdersGoalStats: PosOrdersGoalStats
  footcounterHome: FootcounterHomeSlim | null
}

export default function HomeClient({
  homeNewsPosts,
  customerPortalQuotes,
  customerPortalNettfrontQuotes,
  initialMonthlyQuotes,
  initialMonthlySupplierOrders,
  initialWeeklyCutting,
  initialWeeklyEdgeBanding,
  initialTodayAttendance,
  posOrdersGoalStats,
  footcounterHome
}: HomeClientProps) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <HomeNewsCard initialPosts={homeNewsPosts} />
        </Grid>

        <Grid item xs={12}>
          <CustomerPortalQuotesTable quotes={customerPortalQuotes} />
        </Grid>

        <Grid item xs={12}>
          <CustomerPortalNettfrontQuotesTable quotes={customerPortalNettfrontQuotes} />
        </Grid>

        <Grid item xs={12}>
          <BacklogTotalsCard />
        </Grid>

        <Grid item xs={12}>
          <TodayAttendanceDashboard
            dateLabel={initialTodayAttendance.dateLabel}
            employees={initialTodayAttendance.employees}
          />
        </Grid>

        {footcounterHome && (
          <Grid item xs={12}>
            <FootcounterHomeCard data={footcounterHome} />
          </Grid>
        )}

        <Grid item xs={12}>
          <WeeklyCuttingChart initialData={initialWeeklyCutting} />
        </Grid>

        <Grid item xs={12}>
          <WeeklyEdgeBandingChart initialData={initialWeeklyEdgeBanding} />
        </Grid>

        <Grid item xs={12} lg={6}>
          <MonthlyQuotesCard initialData={initialMonthlyQuotes} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <MonthlySupplierOrdersCard initialData={initialMonthlySupplierOrders} />
        </Grid>

        <Grid item xs={12}>
          <PosOrdersGoalsCard posOrdersGoalStats={posOrdersGoalStats} />
        </Grid>
      </Grid>
    </Container>
  )
}
