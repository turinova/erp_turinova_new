import { Box, Typography } from '@mui/material'
import MuhelyClient from './MuhelyClient'

export const metadata = {
  title: 'Műhely'
}

export default function MuhelyPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h4' sx={{ mb: 2 }}>
        Műhely
      </Typography>
      <MuhelyClient />
    </Box>
  )
}

