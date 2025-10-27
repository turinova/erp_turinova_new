// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

export const metadata = {
  title: 'Corpus - Turinova Corpus Portal',
  description: 'Corpus management and data'
}

export default async function CorpusPage() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Header Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-database-2-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                Corpus Kezelés
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Itt kezelheti a corpus adatokat
              </Typography>
            </div>
          </Box>
        </CardContent>
      </Card>

      {/* Content Section */}
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant='h5' className='mb-4'>
                Corpus Adatok
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Ez egy minta oldal a Corpus adatok kezeléséhez. Itt jeleníthet meg táblázatokat, 
                űrlapokat és egyéb corpus-hoz kapcsolódó funkciókat.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <i className='ri-file-list-3-line text-3xl text-success' />
                <div>
                  <Typography variant='h6'>
                    Statisztikák
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Corpus statisztikai adatok
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <i className='ri-settings-3-line text-3xl text-info' />
                <div>
                  <Typography variant='h6'>
                    Beállítások
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Corpus kezelési beállítások
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

