'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Chip, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

type FeeDef = {
  id: string
  code: string
  name: string
  type: string
  default_vat_rate: number
  default_gross: number | null
}

type OrderFeeRow = {
  id?: string
  fee_definition_id: string
  source?: string
  name: string
  type: string
  quantity: number
  unit_gross: number
  vat_rate: number
  line_gross?: number
  allow_delete_from_order?: boolean
}

type CreateFeePayload = {
  fee_definition_id: string
  quantity: number
  unit_gross: number
  vat_rate: number
}

type Props = {
  orderId: string
  isCreateMode: boolean
  vatRates: Array<{ id: string; name: string; kulcs: number }>
  onCreateFeesChange?: (fees: CreateFeePayload[]) => void
  onFeesChanged?: () => void
}

export default function OrderFeesEditor({ orderId, isCreateMode, vatRates, onCreateFeesChange, onFeesChanged }: Props) {
  const [defs, setDefs] = useState<FeeDef[]>([])
  const [rows, setRows] = useState<OrderFeeRow[]>([])
  const [selectedFeeDefId, setSelectedFeeDefId] = useState('')
  const [saving, setSaving] = useState(false)

  const availableDefs = useMemo(() => defs.filter(d => !rows.some(r => r.fee_definition_id === d.id)), [defs, rows])
  const formatMoney = (value: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 }).format(value || 0)

  const loadDefs = async () => {
    const res = await fetch('/api/fees?active=true')
    const data = await res.json()
    if (res.ok) setDefs(data.fees || [])
  }

  const loadOrderFees = async () => {
    if (isCreateMode || !orderId) return
    const res = await fetch(`/api/orders/${orderId}/fees`)
    const data = await res.json()
    if (res.ok) {
      setRows((data.fees || []).map((r: any) => ({
        id: r.id,
        fee_definition_id: r.fee_definition_id,
        source: r.source || 'manual',
        name: r.name,
        type: r.type,
        quantity: Number(r.quantity) || 1,
        unit_gross: Number(r.unit_gross) || 0,
        vat_rate: Number(r.vat_rate) || 27,
        line_gross: Number(r.line_gross) || 0
      })))
    }
  }

  useEffect(() => {
    loadDefs()
    loadOrderFees()
  }, [orderId, isCreateMode])

  useEffect(() => {
    if (!isCreateMode) return
    onCreateFeesChange?.(rows.map(r => ({
      fee_definition_id: r.fee_definition_id,
      quantity: r.quantity,
      unit_gross: r.unit_gross,
      vat_rate: r.vat_rate
    })))
  }, [rows, isCreateMode, onCreateFeesChange])

  const addRow = async () => {
    if (!selectedFeeDefId) return
    const def = defs.find(d => d.id === selectedFeeDefId)
    if (!def) return

    if (isCreateMode) {
      setRows(prev => [...prev, {
        fee_definition_id: def.id,
        source: 'manual',
        name: def.name,
        type: def.type,
        quantity: 1,
        unit_gross: Number(def.default_gross ?? 0),
        vat_rate: Number(def.default_vat_rate ?? 27)
      }])
      setSelectedFeeDefId('')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee_definition_id: def.id, quantity: 1, unit_gross: Number(def.default_gross ?? 0), vat_rate: Number(def.default_vat_rate ?? 27) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Díj hozzáadása sikertelen')
      await loadOrderFees()
      onFeesChanged?.()
      setSelectedFeeDefId('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Díj hozzáadása sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const updateRow = async (row: OrderFeeRow, patch: Partial<OrderFeeRow>) => {
    const next = { ...row, ...patch }
    if (isCreateMode) {
      setRows(prev => prev.map(r => (r.fee_definition_id === row.fee_definition_id ? next : r)))
      return
    }
    if (!row.id) return
    try {
      const res = await fetch(`/api/orders/${orderId}/fees/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: next.quantity,
          unit_gross: next.unit_gross,
          vat_rate: next.vat_rate
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Díj frissítése sikertelen')
      await loadOrderFees()
      onFeesChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Díj frissítése sikertelen')
    }
  }

  const deleteRow = async (row: OrderFeeRow) => {
    if (isCreateMode) {
      setRows(prev => prev.filter(r => r.fee_definition_id !== row.fee_definition_id))
      return
    }
    if (!row.id) return
    try {
      const res = await fetch(`/api/orders/${orderId}/fees/${row.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Díj törlése sikertelen')
      await loadOrderFees()
      onFeesChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Díj törlése sikertelen')
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#6a1b9a',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#4a148c' }}>Díjak</Typography>
          <Typography variant="body2" color="text.secondary">
            Szállítási és egyéb díjak. A webshopból átvett szállítás itt automatikusan megjelenik és szerkeszthető.
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <TextField
          select
          label="Díj hozzáadása katalógusból"
          value={selectedFeeDefId}
          onChange={(e) => setSelectedFeeDefId(e.target.value)}
          size="small"
          sx={{ minWidth: 320 }}
        >
          {availableDefs.map(d => (
            <MenuItem key={d.id} value={d.id}>{d.name} ({d.type})</MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={addRow} disabled={!selectedFeeDefId || saving}>+ Hozzáadás</Button>
      </Stack>

      <Stack spacing={1.25}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nincs díj a rendelésen.</Typography>
        ) : rows.map((row) => (
          <Box
            key={row.id || row.fee_definition_id}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: row.source === 'import_webshop' ? 'rgba(33, 150, 243, 0.04)' : 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.name}</Typography>
                <Chip label={row.type} size="small" variant="outlined" />
                {row.source === 'import_webshop' ? (
                  <Chip label="Webshopból átvéve" size="small" color="info" />
                ) : null}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Sor összesen: {formatMoney((Number(row.quantity) || 1) * (Number(row.unit_gross) || 0))} Ft
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                label="Bruttó (Ft)"
                value={row.unit_gross}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setRows(prev => prev.map(r => (r.id === row.id || r.fee_definition_id === row.fee_definition_id ? { ...r, unit_gross: v } : r)))
                }}
                onBlur={() => updateRow(row, { unit_gross: row.unit_gross })}
              />
              <TextField
                size="small"
                select
                label="ÁFA kulcs"
                value={row.vat_rate}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setRows(prev => prev.map(r => (r.id === row.id || r.fee_definition_id === row.fee_definition_id ? { ...r, vat_rate: v } : r)))
                }}
                onBlur={() => updateRow(row, { vat_rate: row.vat_rate })}
              >
                {vatRates.map(v => (
                  <MenuItem key={v.id} value={v.kulcs}>
                    {v.name} ({v.kulcs}%)
                  </MenuItem>
                ))}
              </TextField>
              <IconButton onClick={() => deleteRow(row)} color="error" aria-label="Díj törlése">
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

