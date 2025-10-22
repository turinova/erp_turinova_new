// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

export const metadata = {
  title: 'Kezdőlap - Turinova Ügyfélportál',
  description: 'Turinova ügyfélportál kezdőlap'
}

export default function HomePage() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Welcome Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-home-heart-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                Üdvözöljük a Turinova Ügyfélportálon!
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Kezelheti árajánlatait és nyomon követheti rendeléseit
              </Typography>
            </div>
          </Box>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <Grid container spacing={6}>
        <Grid item xs={12} sm={6} md={3}>
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
                  <i className='ri-file-list-3-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    0
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Árajánlatok
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
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
                  <i className='ri-shopping-cart-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    0
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Rendelések
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
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
                  <i className='ri-time-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    0
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Folyamatban
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
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
                  <i className='ri-check-double-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    0
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Kész
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Coming Soon Section */}
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <i className='ri-tools-line text-6xl text-primary mb-4' />
            <Typography variant='h5' className='font-bold mb-2'>
              Hamarosan elérhető funkciók
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ maxWidth: 600, mx: 'auto' }}>
              Az árajánlat készítő és rendeléskezelő rendszer hamarosan elérhető lesz.
              Addig is, kérjük, vegye fel velünk a kapcsolatot.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </div>
  )
}
