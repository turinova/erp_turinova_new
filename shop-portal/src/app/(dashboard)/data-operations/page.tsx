import NextLink from 'next/link'

import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Dataset as DatasetIcon } from '@mui/icons-material'

import DataOperationsClient from './DataOperationsClient'

export default function DataOperationsPage() {
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
          <DatasetIcon fontSize="small" />
          Adatműveletek
        </Typography>
      </Breadcrumbs>

      <DataOperationsClient />
    </Box>
  )
}
