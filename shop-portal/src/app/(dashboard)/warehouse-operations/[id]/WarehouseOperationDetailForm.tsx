'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  Warehouse as WarehouseIcon,
  LocalShipping as LocalShippingIcon,
  CalendarToday as CalendarTodayIcon,
  Person as PersonIcon,
  Note as NoteIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import StockMovementsTable from './StockMovementsTable'

interface WarehouseOperation {
  id: string
  operation_number: string
  operation_type: string
  status: string
  shipment_id: string | null
  shipments: { id: string; shipment_number: string; status: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string; code: string | null } | null
  started_at: string | null
  completed_at: string | null
  created_by_user: { id: string; email: string; full_name: string | null } | null
  completed_by_user: { id: string; email: string; full_name: string | null } | null
  note: string | null
  created_at: string
  updated_at: string
}

interface StockMovement {
  id: string
  movement_type: string
  quantity: number
  unit_cost: number | null
  shelf_location: string | null
  source_type: string
  source_id: string | null
  products: {
    id: string
    name: string
    sku: string
    unit: { id: string; name: string; shortform: string } | null
  } | null
  warehouses: { id: string; name: string } | null
  created_by_user: { id: string; email: string; full_name: string | null } | null
  created_at: string
  note: string | null
}

interface Summary {
  total_items: number
  total_in: number
  total_out: number
  total_net: number
  total_vat: number
  total_gross: number
}

interface WarehouseOperationDetailFormProps {
  initialWarehouseOperation: WarehouseOperation
  initialStockMovements: StockMovement[]
  initialSummary: Summary
}

export default function WarehouseOperationDetailForm({
  initialWarehouseOperation,
  initialStockMovements,
  initialSummary
}: WarehouseOperationDetailFormProps) {
  const router = useRouter()

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {initialWarehouseOperation.operation_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <OperationTypeChip type={initialWarehouseOperation.operation_type} />
            <WarehouseOperationStatusChip status={initialWarehouseOperation.status} />
          </Box>
        </Box>
      </Box>

      {/* Alapinformációk Card */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InventoryIcon color="primary" />
          Alapinformációk
        </Typography>

        <Grid container spacing={3}>
          {/* First Row */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: 'rgba(25, 118, 210, 0.03)',
              border: '1px solid',
              borderColor: 'rgba(25, 118, 210, 0.1)',
              height: '100%'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{
                  p: 0.75,
                  borderRadius: '8px',
                  bgcolor: '#1976d2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <WarehouseIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Raktár
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {initialWarehouseOperation.warehouses?.name || '-'} 
                {initialWarehouseOperation.warehouses?.code && ` (${initialWarehouseOperation.warehouses.code})`}
              </Typography>
            </Box>
          </Grid>

          {initialWarehouseOperation.shipments && (
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(76, 175, 80, 0.03)',
                border: '1px solid',
                borderColor: 'rgba(76, 175, 80, 0.1)',
                height: '100%'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{
                    p: 0.75,
                    borderRadius: '8px',
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <LocalShippingIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Szállítmány
                  </Typography>
                </Box>
                <MuiLink
                  component={NextLink}
                  href={`/shipments/${initialWarehouseOperation.shipments.id}`}
                  sx={{ textDecoration: 'none', fontWeight: 600 }}
                >
                  {initialWarehouseOperation.shipments.shipment_number}
                </MuiLink>
              </Box>
            </Grid>
          )}

          {/* Second Row */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: 'rgba(156, 39, 176, 0.03)',
              border: '1px solid',
              borderColor: 'rgba(156, 39, 176, 0.1)',
              height: '100%'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{
                  p: 0.75,
                  borderRadius: '8px',
                  bgcolor: '#9c27b0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CalendarTodayIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Létrehozva
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {formatDate(initialWarehouseOperation.created_at)}
              </Typography>
              {initialWarehouseOperation.created_by_user && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {initialWarehouseOperation.created_by_user.full_name || initialWarehouseOperation.created_by_user.email}
                </Typography>
              )}
            </Box>
          </Grid>

          {initialWarehouseOperation.completed_at && (
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(76, 175, 80, 0.03)',
                border: '1px solid',
                borderColor: 'rgba(76, 175, 80, 0.1)',
                height: '100%'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{
                    p: 0.75,
                    borderRadius: '8px',
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Befejezve
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {formatDate(initialWarehouseOperation.completed_at)}
                </Typography>
                {initialWarehouseOperation.completed_by_user && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {initialWarehouseOperation.completed_by_user.full_name || initialWarehouseOperation.completed_by_user.email}
                  </Typography>
                )}
              </Box>
            </Grid>
          )}

          {initialWarehouseOperation.note && (
            <Grid item xs={12}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(255, 152, 0, 0.03)',
                border: '1px solid',
                borderColor: 'rgba(255, 152, 0, 0.1)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{
                    p: 0.75,
                    borderRadius: '8px',
                    bgcolor: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <NoteIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Megjegyzés
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {initialWarehouseOperation.note}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Készletmozgások Card */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Készletmozgások
        </Typography>
        <StockMovementsTable movements={initialStockMovements} />
      </Paper>

      {/* Összesítő Card */}
      {initialSummary.total_items > 0 && (
        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Összesítő
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Összes tétel
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {initialSummary.total_items}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Összes bemennyiség
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                  +{initialSummary.total_in.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Összes kimennyiség
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                  -{initialSummary.total_out.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            {initialSummary.total_net > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Nettó összesen
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {formatCurrency(initialSummary.total_net)}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}
    </Box>
  )
}

// Export chip components for reuse
export function OperationTypeChip({ type }: { type: string }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'receiving':
        return 'success'
      case 'transfer':
        return 'info'
      case 'adjustment':
        return 'warning'
      case 'picking':
        return 'secondary'
      case 'return':
        return 'error'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'receiving':
        return 'Bevételezés'
      case 'transfer':
        return 'Átszállítás'
      case 'adjustment':
        return 'Kiigazítás'
      case 'picking':
        return 'Kiválasztás'
      case 'return':
        return 'Visszaküldés'
      default:
        return type
    }
  }

  return (
    <Chip
      label={getTypeLabel(type)}
      color={getTypeColor(type) as any}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

export function WarehouseOperationStatusChip({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'default'
      case 'in_progress':
        return 'info'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Várakozik'
      case 'in_progress':
        return 'Folyamatban'
      case 'completed':
        return 'Befejezve'
      case 'cancelled':
        return 'Törölve'
      default:
        return status
    }
  }

  return (
    <Chip
      label={getStatusLabel(status)}
      color={getStatusColor(status) as any}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}
