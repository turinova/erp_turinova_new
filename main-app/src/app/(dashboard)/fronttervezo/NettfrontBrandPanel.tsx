'use client'

import React from 'react'

import { Box, Card, CardContent, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

/**
 * Jobb oldali Nettfront brand panel a Megrendelő kártya mellett.
 * Csak bizalom / brand — nincs CTA, nincs választó.
 */
export default function NettfrontBrandPanel() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: alpha(theme.palette.primary.main, isDark ? 0.4 : 0.22),
        bgcolor: isDark ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.05),
        boxShadow: 'none'
      }}
    >
      <CardContent
        sx={{
          height: '100%',
          minHeight: { md: 280 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 2,
          p: { xs: 2.5, sm: 3 },
          '&:last-child': { pb: { xs: 2.5, sm: 3 } }
        }}
      >
        <Box
          component="img"
          src="/brands/nettfront-logo.svg"
          alt="Nettfront"
          sx={{
            height: { xs: 48, sm: 64 },
            width: 'auto',
            maxWidth: '90%',
            display: 'block',
            ...(isDark && { filter: 'invert(1)', opacity: 0.95 })
          }}
        />
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.125rem', sm: '1.25rem' },
              lineHeight: 1.3,
              color: 'primary.main'
            }}
          >
            Nettfront frontok
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
