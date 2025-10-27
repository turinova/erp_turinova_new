// Next Imports
import type { Metadata } from 'next'
import { Box, Container, Typography, Paper } from '@mui/material'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'Turinova ERP rendszer Adatkezelési tájékoztatója'
}

const PrivacyPolicyPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', py: 6, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 3 }}>
            Adatkezelési tájékoztató
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
            Ez az oldal hamarosan elérhető lesz.
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}

export default PrivacyPolicyPage

