import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Link as LinkIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllConnections } from '@/lib/connections-server'
import ConnectionsTable from './ConnectionsTable'

// This is a server component - data is fetched on the server
export default async function ConnectionsPage() {
  // Fetch connections on the server
  const connections = await getAllConnections()

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
          Kapcsolatok
        </Typography>
      </Breadcrumbs>

      <ConnectionsTable initialConnections={connections} />
    </Box>
  )
}
