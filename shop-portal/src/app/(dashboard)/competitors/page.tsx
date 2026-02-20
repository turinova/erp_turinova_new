import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllCompetitors } from '@/lib/competitors-server'
import CompetitorsTable from './CompetitorsTable'

// This is a server component - data is fetched on the server
export default async function CompetitorsPage() {
  // Fetch competitors on the server
  const competitors = await getAllCompetitors()

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingUpIcon fontSize="small" />
          Versenytársak
        </Typography>
      </Breadcrumbs>

      <CompetitorsTable initialCompetitors={competitors} />
    </Box>
  )
}
