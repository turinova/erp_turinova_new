'use client'

import { Box, Grid, Paper, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import { formatBucketSubline, type WeatherTrafficBucket, type WeatherTrafficImpact } from '@/lib/footcounter-weather-impact'
import { formatAvg } from '@/lib/footcounter-format'
import { WEATHER_RAIN_DAY_CRITERIA_HU } from '@/lib/footcounter-weather'

const BUCKET_STYLE: Record<
  WeatherTrafficBucket['key'],
  { color: 'info' | 'success' | 'warning' | 'error'; icon: string }
> = {
  rain: { color: 'info', icon: '☔' },
  snow: { color: 'info', icon: '❄️' },
  dry: { color: 'success', icon: '☀️' },
  heat: { color: 'warning', icon: '🌡️' },
  frost: { color: 'info', icon: '🧊' }
}

type FootcounterWeatherImpactProps = {
  impact: WeatherTrafficImpact
  monthLabel: string
  avgTempMaxC?: number | null
}

export default function FootcounterWeatherImpact({ impact, monthLabel, avgTempMaxC }: FootcounterWeatherImpactProps) {
  const theme = useTheme()

  if (!impact.has_weather) return null

  const visible = impact.buckets.filter(b => b.days > 0 || b.key === 'rain' || b.key === 'dry')
  if (visible.length === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 0.5 }}>
        Időjárás hatás · {monthLabel}
      </Typography>
      <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1.5 }}>
        Átlagos napi belépő időjárás szerint (bázis: {formatAvg(impact.baseline_avg_in)} be/nap, {impact.baseline_days}{' '}
        nap). {WEATHER_RAIN_DAY_CRITERIA_HU}
      </Typography>
      <Grid container spacing={1.5}>
        {visible.map(bucket => {
          const style = BUCKET_STYLE[bucket.key]
          return (
            <Grid item xs={12} sm={6} md={visible.length >= 4 ? 3 : 4} key={bucket.key}>
              <Paper
                variant='outlined'
                sx={{
                  p: 2,
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    bgcolor: `${style.color}.main`,
                    borderRadius: '4px 0 0 4px'
                  }
                }}
              >
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                  {style.icon} {bucket.label}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.2, mt: 0.5 }}>
                  {bucket.days}
                  <Typography component='span' variant='body2' color='text.secondary' sx={{ fontWeight: 500, ml: 0.5 }}>
                    nap
                  </Typography>
                </Typography>
                <Typography variant='body2' sx={{ mt: 0.75, fontWeight: 600 }}>
                  {formatBucketSubline(bucket, impact.baseline_avg_in)}
                </Typography>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
      {avgTempMaxC != null && (
        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1.5 }}>
          Havi átlag max hőmérséklet:{' '}
          <Box component='span' sx={{ fontWeight: 700, color: 'info.main' }}>
            {avgTempMaxC} °C
          </Box>
        </Typography>
      )}
      <Box
        sx={{
          mt: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.1 : 0.06)
        }}
      >
        <Typography variant='caption' color='text.secondary'>
          Tipp: az időjárás magyarázhatja a napi ingadozást, de nem minden visszaesés okozata — kampány, ünnep és szezon
          is számít.
        </Typography>
      </Box>
    </Box>
  )
}
