// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

// Server Imports
import { getDashboardStats } from '@/lib/supabase-server'

export const metadata = {
  title: 'Dashboard - Turinova Admin',
  description: 'Turinova Admin Dashboard'
}

export default async function HomePage() {
  const stats = await getDashboardStats()

  return (
    <div className='flex flex-col gap-6'>
      {/* Welcome Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-dashboard-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                Üdvözöljük az Admin Portálon!
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Tenant kezelés és statisztikák
              </Typography>
            </div>
          </Box>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <Grid container spacing={6}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'primary.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-building-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.totalTenants}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Összes Ügyfél
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'success.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-checkbox-circle-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.activeTenants}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Aktív Ügyfelek
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'info.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-vip-card-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.totalSubscriptions}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Összes Előfizetés
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'warning.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-checkbox-circle-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.activeSubscriptions}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Aktív Előfizetések
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'secondary.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-coins-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.totalTuritokenUsed.toLocaleString('hu-HU')}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Turitoken (ez hónap)
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  )
}

