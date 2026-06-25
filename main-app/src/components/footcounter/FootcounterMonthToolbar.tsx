'use client'

import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloudSyncIcon from '@mui/icons-material/CloudSync'

type MonthOption = { key: string; label: string }

type FootcounterMonthToolbarProps = {
  monthKey: string
  monthOptions: MonthOption[]
  onMonthKeyChange: (key: string) => void
  onRefresh: () => void
  onWeatherSync: () => void
  statsLoading: boolean
  weatherSyncing: boolean
  lastUpdatedAt?: Date | null
}

export default function FootcounterMonthToolbar({
  monthKey,
  monthOptions,
  onMonthKeyChange,
  onRefresh,
  onWeatherSync,
  statsLoading,
  weatherSyncing,
  lastUpdatedAt
}: FootcounterMonthToolbarProps) {
  const idx = monthOptions.findIndex(m => m.key === monthKey)
  const canPrev = idx >= 0 && idx < monthOptions.length - 1
  const canNext = idx > 0

  const goPrev = () => {
    if (canPrev) onMonthKeyChange(monthOptions[idx + 1].key)
  }
  const goNext = () => {
    if (canNext) onMonthKeyChange(monthOptions[idx - 1].key)
  }

  const updatedLabel =
    lastUpdatedAt &&
    lastUpdatedAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        mb: 2,
        py: 1.5,
        px: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: t => (t.palette.mode === 'dark' ? 'none' : '0 1px 3px rgba(15,23,42,0.06)')
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent='space-between'
        spacing={1.5}
      >
        <Stack direction='row' alignItems='center' spacing={0.5} flexWrap='wrap' useFlexGap>
          <IconButton size='small' onClick={goPrev} disabled={!canPrev} aria-label='Előző hónap'>
            <ChevronLeftIcon />
          </IconButton>
          <FormControl size='small' sx={{ minWidth: { xs: '100%', sm: 200 } }}>
            <InputLabel id='footcounter-month-label'>Hónap</InputLabel>
            <Select
              labelId='footcounter-month-label'
              value={monthKey}
              label='Hónap'
              onChange={e => {
                const v = String(e.target.value || '')
                if (/^[0-9]{4}-[0-9]{2}$/.test(v)) onMonthKeyChange(v)
              }}
            >
              {monthOptions.map(m => (
                <MenuItem key={m.key} value={m.key}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton size='small' onClick={goNext} disabled={!canNext} aria-label='Következő hónap'>
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        <Stack direction='row' alignItems='center' spacing={1} flexWrap='wrap' useFlexGap justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
          {updatedLabel && (
            <Typography variant='caption' color='text.secondary' sx={{ mr: { md: 1 } }}>
              Frissítve: {updatedLabel}
            </Typography>
          )}
          <Tooltip title='Adatok újratöltése'>
            <span>
              <IconButton size='small' onClick={onRefresh} disabled={statsLoading} aria-label='Frissítés'>
                {statsLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize='small' />}
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant='outlined'
            size='small'
            startIcon={weatherSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
            onClick={onWeatherSync}
            disabled={weatherSyncing || statsLoading}
          >
            Időjárás szinkron
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
