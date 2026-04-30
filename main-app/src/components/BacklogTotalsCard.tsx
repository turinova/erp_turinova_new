'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Box, Divider, CircularProgress } from '@mui/material'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import StraightenIcon from '@mui/icons-material/Straighten'

type MetricKey = 'cutting' | 'edge'

type MetricState = {
  loading: boolean
  value: number | null
}

function fmtMeters(n: number) {
  return `${Math.round(n).toLocaleString('hu-HU')} m`
}

export default function BacklogTotalsCard() {
  const [cutting, setCutting] = useState<MetricState>({ loading: true, value: null })
  const [edge, setEdge] = useState<MetricState>({ loading: true, value: null })

  const loadMetric = async (key: MetricKey) => {
    const url =
      key === 'cutting' ? '/api/dashboard/cutting-remaining-past' : '/api/dashboard/edge-banding-remaining-past'

    try {
      if (key === 'cutting') setCutting(s => ({ ...s, loading: true }))
      else setEdge(s => ({ ...s, loading: true }))

      const res = await fetch(url)
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || res.statusText)
      const value = Number(j?.remainingTotalM)
      if (key === 'cutting') setCutting({ loading: false, value: Number.isFinite(value) ? value : 0 })
      else setEdge({ loading: false, value: Number.isFinite(value) ? value : 0 })
    } catch (e) {
      console.error('Error loading backlog metric:', key, e)
      if (key === 'cutting') setCutting({ loading: false, value: null })
      else setEdge({ loading: false, value: null })
    }
  }

  useEffect(() => {
    loadMetric('cutting')
    loadMetric('edge')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card sx={{ border: '2px solid', borderColor: 'error.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Elmaradás (múlt napok)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Csak a tegnap előtti gyártási dátumok. Törölt / sztornózott nem számít. Késznek számít: ready vagy finished.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'error.lighter', border: '1px solid', borderColor: 'error.light' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ContentCutIcon fontSize="small" />
              <Typography sx={{ fontWeight: 800 }}>Szabás elmaradás</Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              {cutting.loading ? <CircularProgress size={20} /> : cutting.value === null ? '-' : fmtMeters(cutting.value)}
            </Typography>
          </Box>

          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'error.lighter', border: '1px solid', borderColor: 'error.light' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <StraightenIcon fontSize="small" />
              <Typography sx={{ fontWeight: 800 }}>Élzárás elmaradás</Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              {edge.loading ? <CircularProgress size={20} /> : edge.value === null ? '-' : fmtMeters(edge.value)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

