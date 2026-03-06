'use client'

import React, { useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
  Paper
} from '@mui/material'
import { Description as DescriptionIcon } from '@mui/icons-material'

interface Step7ContentSEOProps {
  data: {
    name: string
    short_description: string
    description: string
    meta_title: string
    meta_description: string
    url_slug: string
  }
  onChange: (field: string, value: string) => void
}

export default function Step7ContentSEO({
  data,
  onChange
}: Step7ContentSEOProps) {
  // Auto-generate URL slug from name if not set
  useEffect(() => {
    if (data.name && (!data.url_slug || data.url_slug === '')) {
      const slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      onChange('url_slug', slug)
    }
  }, [data.name, data.url_slug])

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#00acc1',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#00acc1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 172, 193, 0.3)'
        }}>
          <DescriptionIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#00838f' }}>
          Tartalom & SEO
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Rövid leírás"
            value={data.short_description}
            onChange={(e) => onChange('short_description', e.target.value)}
            multiline
            rows={3}
            helperText="Opcionális - Később AI-val generálható"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Leírás"
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
            multiline
            rows={6}
            helperText="Opcionális - Később AI-val generálható"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Meta cím"
            value={data.meta_title}
            onChange={(e) => onChange('meta_title', e.target.value)}
            helperText="Opcionális - Később AI-val generálható"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Meta leírás"
            value={data.meta_description}
            onChange={(e) => onChange('meta_description', e.target.value)}
            multiline
            rows={3}
            helperText="Opcionális - Később AI-val generálható"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="URL slug"
            value={data.url_slug}
            onChange={(e) => {
              // Sanitize URL slug
              const slug = e.target.value
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '')
              onChange('url_slug', slug)
            }}
            helperText="A termék URL-je (automatikusan generálva a névből)"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        </Grid>
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Megjegyzés:</strong> A leírások és SEO mezők később is szerkeszthetők és AI-val generálhatók a termék szerkesztése oldalon.
        </Typography>
      </Alert>
    </Paper>
  )
}
