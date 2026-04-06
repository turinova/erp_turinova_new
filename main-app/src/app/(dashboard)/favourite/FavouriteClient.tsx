'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  CardActionArea,
  Breadcrumbs,
  Link,
  LinearProgress
} from '@mui/material'
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon
} from '@mui/icons-material'

export interface FavouriteCustomer {
  id: string
  name: string
  email: string | null
  mobile: string | null
  discount_percent: number
  total_revenue: number
  avg_monthly_revenue: number
}

interface FavouriteClientProps {
  initialCustomers: FavouriteCustomer[]
}

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

/** t ∈ [0,1]: red (low) → amber → green (high). Used for rank among cards, not raw revenue. */
function rankHeatColor(t: number): string {
  const red = { r: 198, g: 40, b: 47 }
  const amber = { r: 217, g: 119, b: 6 }
  const green = { r: 22, g: 163, b: 74 }
  const u = Math.max(0, Math.min(1, t))
  let r: number
  let g: number
  let b: number
  if (u < 0.5) {
    const s = u / 0.5
    r = lerpChannel(red.r, amber.r, s)
    g = lerpChannel(red.g, amber.g, s)
    b = lerpChannel(red.b, amber.b, s)
  } else {
    const s = (u - 0.5) / 0.5
    r = lerpChannel(amber.r, green.r, s)
    g = lerpChannel(amber.g, green.g, s)
    b = lerpChannel(amber.b, green.b, s)
  }
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

/** Stripe / chip color: position in list. First card (legelső a sorrendben) = zöld, utolsó = piros. */
function accentForCardIndex(index: number, total: number): string {
  if (total <= 0) return '#9E9E9E'
  if (total === 1) return rankHeatColor(1)
  const t = (total - 1 - index) / (total - 1)
  return rankHeatColor(Math.max(0, Math.min(1, t)))
}

/** Readable label on a solid #RRGGBB background (avoids theme text color overriding chip text). */
function contrastTextOnHex(hex: string): '#ffffff' | '#1c1c1c' {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B
  return L > 0.55 ? '#1c1c1c' : '#ffffff'
}

function formatCompactFt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 Ft'
  if (value >= 1_000_000_000) {
    const v = value / 1_000_000_000
    return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(v)} Mrd Ft`
  }
  if (value >= 1_000_000) {
    const v = value / 1_000_000
    return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(v)} M Ft`
  }
  if (value >= 1000) {
    const v = value / 1000
    return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(v)} E Ft`
  }
  return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(value)} Ft`
}

export default function FavouriteClient({ initialCustomers }: FavouriteClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return initialCustomers
    const q = search.toLowerCase()
    return initialCustomers.filter(c => c.name.toLowerCase().includes(q))
  }, [initialCustomers, search])

  const maxAvgMonthly = useMemo(
    () => filtered.reduce((m, c) => Math.max(m, c.avg_monthly_revenue), 0),
    [filtered]
  )

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label='breadcrumb' sx={{ mb: 3 }}>
        <Link
          href='/'
          underline='hover'
          color='inherit'
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize='small' />
          Főoldal
        </Link>
        <Typography color='text.primary' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Asztalosok
        </Typography>
      </Breadcrumbs>

      <Typography variant='h4' fontWeight={500} sx={{ mb: 0.5 }}>
        Asztalosok
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
        {initialCustomers.length} kedvenc ügyfél · rendezés: átlagos havi bevétel
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
        Szín: helyezés a listában (1. = zöld, utolsó = piros). A kitöltött sáv: ügyfél ~Ft/hó értéke a listában lévő legmagasabb havi átlaghoz viszonyítva.
      </Typography>

      <TextField
        fullWidth
        size='small'
        placeholder='Keresés név alapján...'
        value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ mt: 2, mb: 2 }}
      />

      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Typography variant='h6'>
            {search ? 'Nincs találat' : 'Nincs kedvenc ügyfél'}
          </Typography>
          <Typography variant='body2' sx={{ mt: 1 }}>
            {search
              ? 'Próbálj más keresőkifejezést'
              : 'Az ügyfelek oldalon jelölhetsz kedvencet a csillag ikonnal'}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)'
            },
            gap: 2,
            mt: 1
          }}
        >
          {filtered.map((customer, index) => {
            const accent = accentForCardIndex(index, filtered.length)
            const discountChipLabel = contrastTextOnHex(accent)
            const discount = customer.discount_percent ?? 0
            const progressPct =
              maxAvgMonthly > 0
                ? Math.min(100, (customer.avg_monthly_revenue / maxAvgMonthly) * 100)
                : 0

            return (
              <Card
                key={customer.id}
                sx={{ overflow: 'hidden' }}
              >
                <Box sx={{ height: 4, bgcolor: accent }} />

                <CardActionArea onClick={() => router.push(`/favourite/${customer.id}`)}>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 1,
                        mb: 2
                      }}
                    >
                      <Typography
                        variant='h6'
                        sx={{
                          lineHeight: 1.35,
                          flex: 1,
                          minWidth: 0,
                          pr: 0.5
                        }}
                      >
                        {customer.name}
                      </Typography>
                      <Box
                        sx={{
                          px: 1.25,
                          py: 0.35,
                          borderRadius: 999,
                          flexShrink: 0,
                          bgcolor: discount > 0 ? accent : 'action.hover',
                          '& .MuiTypography-caption': {
                            color: discount > 0 ? discountChipLabel : 'text.secondary'
                          }
                        }}
                      >
                        <Typography variant='caption' fontWeight={700} sx={{ lineHeight: 1.2 }}>
                          {discount}%
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant='body2' color={customer.mobile ? 'text.secondary' : 'text.disabled'}>
                          {customer.mobile || '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <EmailIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography
                          variant='body2'
                          color={customer.email ? 'text.secondary' : 'text.disabled'}
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {customer.email || '—'}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.75 }}>
                      Átlagos havi bevétel
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 1,
                        mb: 0.5
                      }}
                    >
                      <Typography variant='body1' fontWeight={700} sx={{ color: 'text.primary', lineHeight: 1.2 }}>
                        ~{formatCompactFt(customer.avg_monthly_revenue)}/hó
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ flexShrink: 0, textAlign: 'right', maxWidth: '48%' }}
                      >
                        Összesen: {formatCompactFt(customer.total_revenue)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant='determinate'
                      value={progressPct}
                      sx={{
                        height: 6,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 1,
                          bgcolor: accent
                        }
                      }}
                    />
                  </CardContent>
                </CardActionArea>
              </Card>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
