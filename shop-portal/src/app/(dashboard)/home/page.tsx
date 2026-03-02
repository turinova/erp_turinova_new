import { Box, Breadcrumbs, Typography, Button } from '@mui/material'
import { Home as HomeIcon } from '@mui/icons-material'
import Link from 'next/link'

// This is a server component - simple blank page
export default async function HomePage() {
  const isDev = process.env.NODE_ENV === 'development'
  
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

      {isDev && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Development Mode: If you're stuck in a logged-in state, click below to clear your session:
          </Typography>
          <Button 
            variant="outlined" 
            size="small"
            component={Link}
            href="/login?logout=true"
          >
            Clear Session & Go to Login
          </Button>
        </Box>
      )}
    </Box>
  )
}
