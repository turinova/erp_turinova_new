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

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
        Átadás
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Csomagok kiadása a futárnak vagy a vevőnek. A fül és a „Teendők” nézet mutatja, mit kell ma megcsinálni; a „Legutóbb…” nézet csak visszakereséshez.
      </Typography>

      <DispatchTabs />
    </Box>
  )
}
