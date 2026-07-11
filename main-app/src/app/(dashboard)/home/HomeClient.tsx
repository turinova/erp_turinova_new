'use client'

import React from 'react'
import { Container, Grid } from '@mui/material'
import CustomerPortalQuotesTable from '@/components/CustomerPortalQuotesTable'
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

interface CustomerQuote {
  id: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface HomeClientProps {
  customerPortalQuotes: CustomerQuote[]
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
  customerPortalQuotes,
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
          <CustomerPortalQuotesTable quotes={customerPortalQuotes} />
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
