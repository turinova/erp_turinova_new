'use client'

import React from 'react'
import Link from 'next/link'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

type HomeWelcomeCardProps = {
  companyName: string
  customerName?: string
}

/**
 * Home welcome panel — matches Újdonságok card vibe (black accent, overline, clean border).
 */
export default function HomeWelcomeCard({ companyName, customerName }: HomeWelcomeCardProps) {
  const greeting =
    customerName && customerName.trim().length > 0
      ? `Üdvözlünk, ${customerName.trim()}`
      : 'Üdvözlünk'

  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2.5, sm: 3 },
          py: 1.75,
          bgcolor: '#fff'
        }}
      >
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: { xs: '0.8rem', sm: '0.875rem' },
            letterSpacing: '0.04em',
            color: '#0a0a0a',
            textTransform: 'lowercase'
          }}
        >
          ügyfélportál · {companyName}
        </Typography>
      </Box>

      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          bgcolor: '#fff'
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6 }}
          >
            3 · Portál
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25, lineHeight: 1.3, color: '#0a0a0a' }}>
            {greeting}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.6 }}>
            Árajánlatok és rendelések egy helyen — gyorsan átláthatóan, a{' '}
            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {companyName}
            </Box>{' '}
            műhelyedhez.
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <Button
            component={Link}
            href="/saved"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: '#0a0a0a',
              color: '#fff',
              fontWeight: 700,
              '&:hover': { bgcolor: '#222' }
            }}
          >
            Mentett ajánlatok
          </Button>
          <Button
            component={Link}
            href="/opti"
            variant="outlined"
            sx={{
              borderColor: 'rgba(0,0,0,0.28)',
              color: '#0a0a0a',
              fontWeight: 700,
              '&:hover': { borderColor: '#0a0a0a', bgcolor: 'rgba(0,0,0,0.04)' }
            }}
          >
            Lapszabászat
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
