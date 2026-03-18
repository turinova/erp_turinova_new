import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as DispatchIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import DispatchTabs from './DispatchTabs'

export default function DispatchPage() {
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
          <DispatchIcon fontSize="small" />
          Átadás
        </Typography>
      </Breadcrumbs>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Átadás
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Futárnak átadandók és személyes átvételek. Jelöld ki a rendeléseket, majd egy kattintással Átadva vagy Átvéve.
      </Typography>

      <DispatchTabs />
    </Box>
  )
}
