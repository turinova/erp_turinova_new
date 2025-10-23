'use client'

import React from 'react'
import { Container, Grid, Box } from '@mui/material'
import WeeklyCuttingChart from '@/components/WeeklyCuttingChart'
import MonthlyQuotesCard from '@/components/MonthlyQuotesCard'
import MonthlySupplierOrdersCard from '@/components/MonthlySupplierOrdersCard'
import CustomerPortalQuotesTable from '@/components/CustomerPortalQuotesTable'

interface CustomerQuote {
  id: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface HomeClientProps {
  customerPortalQuotes: CustomerQuote[]
}

export default function HomeClient({ customerPortalQuotes }: HomeClientProps) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* First Row: Customer Portal Quotes Table - full width */}
        <Grid item xs={12}>
          <CustomerPortalQuotesTable quotes={customerPortalQuotes} />
        </Grid>

        {/* Second Row: Weekly Cutting Chart - full width */}
        <Grid item xs={12}>
          <WeeklyCuttingChart />
        </Grid>

        {/* Third Row: Monthly Cards - side by side, 1/2 width each */}
        <Grid item xs={12} lg={6}>
          <MonthlyQuotesCard />
        </Grid>
        <Grid item xs={12} lg={6}>
          <MonthlySupplierOrdersCard />
        </Grid>

        {/* Add more dashboard widgets here in the future */}
      </Grid>
    </Container>
  )
}

