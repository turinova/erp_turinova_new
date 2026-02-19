import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Security as SecurityIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllUsersWithPermissions, getAllPages } from '@/lib/permissions-server'
import UsersTable from './UsersTable'

// This is a server component - data is fetched on the server
export default async function UsersPage() {
  // Fetch data on the server
  const [users, pages] = await Promise.all([
    getAllUsersWithPermissions(),
    getAllPages()
  ])

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
          Felhasználók és jogosultságok
        </Typography>
      </Breadcrumbs>

      {!users || users.length === 0 ? (
        <>
          <Typography variant="h4" sx={{ mb: 3 }}>
            Felhasználók és jogosultságok kezelése
          </Typography>

          <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nincs elérhető felhasználó
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Jelenleg csak a saját jogosultságait kezelheti. További felhasználók hozzáadásához vegye fel a kapcsolatot a rendszergazdával.
            </Typography>
          </Box>
        </>
      ) : (
        <UsersTable initialUsers={users} initialPages={pages} />
      )}
    </Box>
  )
}
