// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'

// Component Imports
import CorpusViewer from '@/components/corpus-viewer/CorpusViewer'

export const metadata = {
  title: 'Corpus 3D - Turinova Corpus Portal',
  description: 'Interactive 3D corpus designer and visualizer'
}

export default async function CorpusPage() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Header Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <i className='ri-cube-line text-4xl text-primary' />
            <div>
              <Typography variant='h4' className='font-bold'>
                3D Korpus Tervező
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Interaktív korpusz geometria tervező és vizualizáló
              </Typography>
            </div>
          </Box>
        </CardContent>
      </Card>

      {/* 3D Corpus Viewer */}
      <CorpusViewer />
    </div>
  )
}

