'use client'

import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

interface HomeClientProps {
  customerName: string
  companyName: string
  savedQuotesCount: number
  totalOrdersCount: number
  inProgressCount: number
  finishedCount: number
}

export default function HomeClient({
  customerName,
  companyName,
  savedQuotesCount,
  totalOrdersCount,
  inProgressCount,
  finishedCount
}: HomeClientProps) {
  return (
    <div className='flex flex-col gap-6'>
      {/* Welcome Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-home-heart-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                Üdvözöljük a Turinova Ügyfélportálon - {companyName}
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
                    {savedQuotesCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Mentett árajánlatok
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
                    {totalOrdersCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Elküldött rendelések
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
                    {inProgressCount}
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
                    {finishedCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Kész rendelések
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant='h5' className='font-bold mb-3'>
              Gyors műveletek
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box 
                sx={{ 
                  cursor: 'pointer',
                  textAlign: 'center',
                  p: 3,
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={() => window.location.href = '/opti'}
              >
                <i className='ri-scissors-cut-line text-4xl text-primary mb-2' />
                <Typography variant='body2' fontWeight='medium'>
                  Új árajánlat
                </Typography>
              </Box>
              
              <Box 
                sx={{ 
                  cursor: 'pointer',
                  textAlign: 'center',
                  p: 3,
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={() => window.location.href = '/saved'}
              >
                <i className='ri-file-list-3-line text-4xl text-success mb-2' />
                <Typography variant='body2' fontWeight='medium'>
                  Mentett árajánlatok
                </Typography>
              </Box>
              
              <Box 
                sx={{ 
                  cursor: 'pointer',
                  textAlign: 'center',
                  p: 3,
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={() => window.location.href = '/orders'}
              >
                <i className='ri-shopping-cart-line text-4xl text-warning mb-2' />
                <Typography variant='body2' fontWeight='medium'>
                  Rendelések
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </div>
  )
}

