'use client'

import React from 'react'
import { Container, Grid, Box } from '@mui/material'
import WeeklyCuttingChart from '@/components/WeeklyCuttingChart'
import MonthlyQuotesCard from '@/components/MonthlyQuotesCard'
import MonthlySupplierOrdersCard from '@/components/MonthlySupplierOrdersCard'

export default function HomeClient() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* First Row: Weekly Cutting Chart - full width */}
        <Grid item xs={12}>
          <WeeklyCuttingChart />
        </Grid>

        {/* Second Row: Two cards side by side - 1/2 width each */}
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

