'use client'

import React, { useCallback } from 'react'

import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import { getNettfrontCatalog } from './nettfrontCatalog'
import type { FronttervezoFrontTypeKey, FronttervezoLineCounts } from './fronttervezoSession'

export type FrontTypeSegmentOption = {
  value: FronttervezoFrontTypeKey
  label: string
  comingSoon?: boolean
  /** One-line description for available products */
  description?: string
}

type FrontTypeSegmentRowProps = {
  options: FrontTypeSegmentOption[]
  selected: string
  lineCounts: FronttervezoLineCounts
  onChange: (value: FronttervezoFrontTypeKey) => void
}

const DESCRIPTIONS: Partial<Record<FronttervezoFrontTypeKey, string>> = {
  inomat: 'Dekoratív front, több színben'
}

/**
 * Nettfront front típus választó — nagy termék-kártyák (asztalos-barát).
 * Inomat = hero / elérhető; többi = Hamarosan.
 * Színek: theme primary, success, warning, error, divider.
 */
export default function FrontTypeSegmentRow({
  options,
  selected,
  lineCounts,
  onChange
}: FrontTypeSegmentRowProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const inomatCatalog = getNettfrontCatalog('inomat')

  const available = options.filter(o => !o.comingSoon)
  const comingSoon = options.filter(o => o.comingSoon)

  const select = useCallback(
    (value: FronttervezoFrontTypeKey, disabled: boolean) => {
      if (!disabled) onChange(value)
    },
    [onChange]
  )

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', sm: '1.5rem' }, lineHeight: 1.25, mb: 0.75 }}
        >
          Front típus
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: { xs: '1rem', sm: '1.0625rem' }, lineHeight: 1.4, mb: 2.5, maxWidth: 520 }}
        >
          Melyik Nettfront frontot szeretné?
        </Typography>

        <Box
          role="radiogroup"
          aria-label="Front típus"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch',
            gap: 1.5,
            minWidth: 0
          }}
        >
          {/* Hero: available products (Inomat) */}
          {available.map(opt => {
            const isSelected = selected === opt.value
            const count = lineCounts[opt.value]
            const description = opt.description ?? DESCRIPTIONS[opt.value]

            return (
              <Box
                key={opt.value}
                component="button"
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => select(opt.value, false)}
                sx={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  flex: { xs: '1 1 auto', md: '1.55 1 0%' },
                  minWidth: 0,
                  minHeight: { xs: 140, sm: 160 },
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2.5,
                  border: '3px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected
                    ? isDark
                      ? alpha(theme.palette.primary.main, 0.18)
                      : alpha(theme.palette.primary.main, 0.08)
                    : 'background.paper',
                  boxShadow: isSelected
                    ? isDark
                      ? 'none'
                      : `0 4px 14px ${alpha(theme.palette.primary.main, 0.2)}`
                    : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow'], {
                    duration: theme.transitions.duration.shorter
                  }),
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: isDark
                      ? alpha(theme.palette.primary.main, isSelected ? 0.22 : 0.1)
                      : alpha(theme.palette.primary.main, isSelected ? 0.1 : 0.04)
                  },
                  '&:focus-visible': {
                    outline: `3px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
                  <Chip
                    label="Elérhető most"
                    color="success"
                    size="small"
                    sx={{
                      height: 28,
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      '& .MuiChip-label': { px: 1.25 }
                    }}
                  />
                  {count > 0 ? (
                    <Chip
                      label={`${count} tétel`}
                      color="error"
                      size="small"
                      sx={{
                        height: 28,
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        '& .MuiChip-label': { px: 1.25, color: 'common.white' }
                      }}
                    />
                  ) : null}
                </Box>

                <Typography
                  component="span"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.75rem', sm: '2rem' },
                    lineHeight: 1.15,
                    color: isSelected ? 'primary.main' : 'text.primary',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {opt.label}
                </Typography>

                {description ? (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: { xs: '1rem', sm: '1.0625rem' },
                      lineHeight: 1.4,
                      color: 'text.secondary',
                      fontWeight: 500
                    }}
                  >
                    {description}
                  </Typography>
                ) : null}

                {opt.value === 'inomat' && inomatCatalog ? (
                  <Button
                    component="a"
                    href={inomatCatalog.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    color="primary"
                    size="medium"
                    startIcon={<OpenInNewIcon />}
                    onClick={e => e.stopPropagation()}
                    sx={{
                      mt: 'auto',
                      pt: 1,
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      px: 2,
                      py: 1,
                      textTransform: 'none'
                    }}
                  >
                    Katalógus megnyitása
                  </Button>
                ) : null}
              </Box>
            )
          })}

          {/* Coming soon group */}
          <Box
            sx={{
              flex: { xs: '1 1 auto', md: '1 1 0%' },
              minWidth: 0,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5
            }}
          >
            {comingSoon.map(opt => (
              <Box
                key={opt.value}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected === opt.value}
                aria-disabled
                disabled
                onClick={() => select(opt.value, true)}
                sx={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  textAlign: 'center',
                  cursor: 'not-allowed',
                  flex: '1 1 0%',
                  minWidth: 0,
                  minHeight: { xs: 100, sm: 160 },
                  p: { xs: 1.75, sm: 2 },
                  borderRadius: 2.5,
                  border: '2px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.grey[900], 0.03),
                  opacity: 0.72,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.25rem', sm: '1.375rem' },
                    lineHeight: 1.2,
                    color: 'text.primary'
                  }}
                >
                  {opt.label}
                </Typography>
                <Chip
                  label="Hamarosan"
                  color="warning"
                  variant="filled"
                  size="small"
                  sx={{
                    height: 28,
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                    '& .MuiChip-label': { px: 1.25 }
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
