'use client'

import { Container, Typography, Box, Paper } from '@mui/material'
import { useAuth } from '@/contexts/AuthContext'

export default function HomeClient() {
  const { user } = useAuth()

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Üdvözöljük a Shop Portal-ban!
          </Typography>
          {user && (
            <Typography variant="body1" sx={{ mb: 2 }}>
              Bejelentkezve: {user.email}
            </Typography>
          )}
          <Typography variant="body1">
            Ez a webshop kezelő portál kezdőlapja.
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}
