import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Settings as SettingsIcon, Email as EmailIcon, NotificationsActive as NotificationsIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import OrderStatusNotificationsClient from './OrderStatusNotificationsClient'

export default function OrderStatusNotificationsPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SettingsIcon fontSize="small" />
          Beállítások
        </Typography>
        <Link
          component={NextLink}
          href="/settings/email"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <EmailIcon fontSize="small" />
          E-mail
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <NotificationsIcon fontSize="small" />
          Rendelés értesítések
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, letterSpacing: '-0.02em' }}>
        Rendelés e-mail értesítések
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 800, lineHeight: 1.65 }}>
        Állítsa be, mely rendelésállapot-váltásoknál menjen automatikus e-mail a vevőnek (a sablon szövegét és a
        kapcsolókat itt kezelheti). A küldés az ERP-ben történő státuszmódosításkor indul.
      </Typography>

      <OrderStatusNotificationsClient />
    </Box>
  )
}
