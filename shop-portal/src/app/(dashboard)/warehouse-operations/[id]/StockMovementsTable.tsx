'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Link as MuiLink,
  Typography,
  Box
} from '@mui/material'
import NextLink from 'next/link'

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

interface StockMovementsTableProps {
  movements: StockMovement[]
}

function MovementTypeChip({ type }: { type: string }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
        return 'success' // Green
      case 'out':
      case 'transfer_out':
        return 'error' // Red
      case 'adjustment':
        return 'warning' // Orange
      case 'reserved':
      case 'released':
        return 'secondary' // Purple
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'in':
        return 'Be'
      case 'out':
        return 'Ki'
      case 'transfer_in':
        return 'Átszállítás be'
      case 'transfer_out':
        return 'Átszállítás ki'
      case 'adjustment':
        return 'Kiigazítás'
      case 'reserved':
        return 'Foglalt'
      case 'released':
        return 'Felszabadított'
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


export default function StockMovementsTable({ movements }: StockMovementsTableProps) {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getQuantityColor = (quantity: number) => {
    if (quantity > 0) return 'success.main'
    if (quantity < 0) return 'error.main'
    return 'text.primary'
  }

  if (movements.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Nincs készletmozgás ehhez a művelethez.
        </Typography>
      </Box>
    )
  }

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Termék neve</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>SKU</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Mozgás típusa</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Mennyiség</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Egységár</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Összesen</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1 }}>Dátum</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movements.map((movement) => {
            const quantity = parseFloat(movement.quantity.toString())
            const unitCost = movement.unit_cost ? parseFloat(movement.unit_cost.toString()) : null
            const total = unitCost ? Math.abs(quantity) * unitCost : null

            return (
              <TableRow key={movement.id} hover>
                <TableCell sx={{ py: 1 }}>
                  {movement.products ? (
                    <MuiLink
                      component={NextLink}
                      href={`/products/${movement.products.id}`}
                      sx={{ textDecoration: 'none', fontWeight: 500 }}
                    >
                      {movement.products.name}
                    </MuiLink>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  {movement.products?.sku || '-'}
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <MovementTypeChip type={movement.movement_type} />
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: getQuantityColor(quantity)
                    }}
                  >
                    {quantity > 0 ? '+' : ''}{quantity.toFixed(2)} {movement.products?.unit?.shortform || ''}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1, textAlign: 'right' }}>
                  {formatCurrency(unitCost)}
                </TableCell>
                <TableCell sx={{ py: 1, textAlign: 'right', fontWeight: 600 }}>
                  {formatCurrency(total)}
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  {formatDate(movement.created_at)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
