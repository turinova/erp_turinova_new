'use client'

import { Box, Typography } from '@mui/material'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'

type FootcounterInsightBulletsProps = {
  bullets: string[]
}

export default function FootcounterInsightBullets({ bullets }: FootcounterInsightBulletsProps) {
  if (bullets.length === 0) return null

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <LightbulbOutlinedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
          Mit érdemes tudni
        </Typography>
      </Box>
      <Box component='ul' sx={{ m: 0, pl: 2.25 }}>
        {bullets.map((text, i) => (
          <Typography component='li' variant='body2' color='text.secondary' key={i} sx={{ mb: i < bullets.length - 1 ? 0.75 : 0 }}>
            {text}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
