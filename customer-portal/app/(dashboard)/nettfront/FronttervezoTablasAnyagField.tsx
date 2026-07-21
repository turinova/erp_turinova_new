'use client'

import React from 'react'

import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material'

import type { FronttervezoBoardMaterial } from './fronttervezoTypes'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

/** Opti táblás anyag Autocomplete (márka szerint csoportosítva) — kiválasztás után nincs extra chip/előnézet sor. */
type FronttervezoTablasAnyagFieldProps = {
  options: FronttervezoBoardMaterial[]
  valueId: string
  onChange: (materialId: string) => void
  error?: boolean
  helperText?: string
}

export default function FronttervezoTablasAnyagField({
  options,
  valueId,
  onChange,
  error,
  helperText
}: FronttervezoTablasAnyagFieldProps) {
  const selected = options.find(m => m.id === valueId) || null

  return (
    <Autocomplete
      fullWidth
      size="small"
      options={options}
      groupBy={option => option.brand_name?.trim() || 'Ismeretlen'}
      getOptionLabel={option => option.name}
      value={selected}
      onChange={(_event, newValue) => {
        onChange(newValue ? newValue.id : '')
      }}
      disabled={false}
      loading={false}
      loadingText="Anyagok betöltése..."
      noOptionsText="Nincs találat"
      renderInput={params => (
        <TextField
          {...params}
          label="Táblás anyag választás:"
          size="small"
          error={error}
          helperText={helperText}
          sx={inputSx}
          InputProps={{
            ...params.InputProps,
            endAdornment: <>{params.InputProps.endAdornment}</>
          }}
        />
      )}
      renderGroup={params => (
        <Box key={params.key}>
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              padding: '6px 16px',
              backgroundColor: 'grey.100',
              color: 'text.primary',
              fontWeight: 600,
              fontSize: '0.813rem',
              zIndex: 10,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            {params.group}
          </Box>
          {params.children}
        </Box>
      )}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props

        
return (
          <Box
            component="li"
            key={key}
            {...otherProps}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
              minWidth: 0,
              py: 0.25
            }}
          >
            <Typography
              component="span"
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {option.name}
            </Typography>
            <Chip
              label={option.on_stock ? 'Raktári' : 'Rendelős'}
              color={option.on_stock ? 'success' : 'error'}
              variant="filled"
              size="small"
              sx={{
                flexShrink: 0,
                height: 22,
                '& .MuiChip-label': {
                  px: 0.75,
                  fontSize: '0.6875rem',
                  fontWeight: 600
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 500 }}>
              {option.thickness_mm} mm
            </Typography>
          </Box>
        )
      }}
      ListboxProps={{
        style: {
          maxHeight: '320px',
          overflow: 'auto'
        }
      }}
    />
  )
}
