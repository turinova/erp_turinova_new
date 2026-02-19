import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon } from '@mui/icons-material'
import NextLink from 'next/link'

// This is a server component - simple blank page
export default async function HomePage() {
  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Üdvözöljük a Shop Portal rendszerben!
      </Typography>
    </Box>
  )
}
