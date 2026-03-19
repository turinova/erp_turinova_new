import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory2 as PackIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import PackQueueTable from './PackQueueTable'

export default function PackPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} href="/orders" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PackIcon fontSize="small" />
          Csomagolás
        </Typography>
      </Breadcrumbs>

      <PackQueueTable />
    </Box>
  )
}
