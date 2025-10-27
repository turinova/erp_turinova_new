// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

// Component Imports
import DatabaseTemplateCard from './HomeClient'

// Server Imports
import { getCompanyStats } from '@/lib/supabase-server'

export const metadata = {
  title: 'Dashboard - Turinova Admin',
  description: 'Turinova Admin Dashboard'
}

export default async function HomePage() {
  const stats = await getCompanyStats()

  return (
    <div className='flex flex-col gap-6'>
      {/* Welcome Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-dashboard-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                Üdvözöljük a Corpus Portálon!
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Corpus kezelés és statisztikák
              </Typography>
            </div>
          </Box>
        </CardContent>
      </Card>

      {/* Database Template Card */}
      <DatabaseTemplateCard />

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
                    {stats.totalCompanies}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Összes Cég
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
                    {stats.activeCompanies}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Aktív Cégek
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
                  <i className='ri-user-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.totalCustomers}
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
                  backgroundColor: 'warning.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-file-list-3-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.totalQuotes}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Összes Árajánlat
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
                  <i className='ri-calendar-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.quotesThisWeek}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Árajánlatok (7 nap)
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
                  backgroundColor: 'error.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-user-add-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {stats.newCustomersThisMonth}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Új Ügyfelek (30 nap)
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

