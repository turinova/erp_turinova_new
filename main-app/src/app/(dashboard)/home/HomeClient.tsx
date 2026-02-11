'use client'

import React from 'react'
import { Container, Grid } from '@mui/material'
import CustomerPortalQuotesTable from '@/components/CustomerPortalQuotesTable'
import WeeklyCuttingChart from '@/components/WeeklyCuttingChart'
import WeeklyWorktopProductionChart from '@/components/WeeklyWorktopProductionChart'
import MonthlyQuotesCard from '@/components/MonthlyQuotesCard'
import MonthlyWorktopQuotesCard from '@/components/MonthlyWorktopQuotesCard'
import MonthlySupplierOrdersCard from '@/components/MonthlySupplierOrdersCard'

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
  initialMonthlyWorktopQuotes: any
  initialWeeklyCutting: any
  initialWeeklyWorktopProduction: any
}

export default function HomeClient({ 
  customerPortalQuotes,
  initialMonthlyQuotes,
  initialMonthlySupplierOrders,
  initialMonthlyWorktopQuotes,
  initialWeeklyCutting,
  initialWeeklyWorktopProduction
}: HomeClientProps) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* First Row: Customer Portal Quotes Table - full width */}
        <Grid item xs={12}>
          <CustomerPortalQuotesTable quotes={customerPortalQuotes} />
        </Grid>

        {/* Second Row: Weekly Cutting Chart - full width */}
        <Grid item xs={12}>
          <WeeklyCuttingChart initialData={initialWeeklyCutting} />
        </Grid>

        {/* Third Row: Weekly Worktop Production Chart - full width */}
        <Grid item xs={12}>
          <WeeklyWorktopProductionChart initialData={initialWeeklyWorktopProduction} />
        </Grid>

        {/* Fourth Row: Monthly Cards - side by side, 1/2 width each */}
        <Grid item xs={12} lg={6}>
          <MonthlyQuotesCard initialData={initialMonthlyQuotes} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <MonthlySupplierOrdersCard initialData={initialMonthlySupplierOrders} />
        </Grid>

        {/* Fifth Row: Worktop Quotes Card - full width */}
        <Grid item xs={12}>
          <MonthlyWorktopQuotesCard initialData={initialMonthlyWorktopQuotes} />
        </Grid>

        {/* Add more dashboard widgets here in the future */}
      </Grid>
    </Container>
  )
}

