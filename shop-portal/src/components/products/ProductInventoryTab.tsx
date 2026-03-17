'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink,
  Divider,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warehouse as WarehouseIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'

interface ProductInventoryTabProps {
  productId: string
}

interface Summary {
  total_on_hand: number
  total_available: number
  total_reserved: number
  total_value: number
  total_incoming?: number
}

interface Warehouse {
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string | null
  quantity_on_hand: number
  quantity_available: number
  quantity_reserved: number
  average_cost: number
  total_value: number
  last_movement_at: string | null
  incoming: Array<{
    shipment_id: string
    shipment_number: string
    expected_quantity: number
    received_quantity: number
    pending_quantity: number
    expected_arrival_date: string | null
  }>
  warehouse_operations: Array<{
    id: string
    operation_number: string
    operation_type: string
    status: string
    created_at: string
  }>
}

interface StockMovement {
  id: string
  warehouse_id: string
  warehouses: { id: string; name: string; code: string | null } | null
  movement_type: string
  quantity: number
  unit_cost: number | null
  created_at: string
  warehouse_operation_id: string | null
  warehouse_operations: { id: string; operation_number: string } | null
  source_type?: string | null
  source_id?: string | null
  source_order_number?: string | null
}

function MovementTypeChip({ type }: { type: string }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
        return 'success'
      case 'out':
      case 'transfer_out':
        return 'error'
      case 'adjustment':
        return 'warning'
      case 'reserved':
      case 'released':
        return 'secondary'
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

function WarehouseInventoryCard({ warehouse, expanded, onToggle }: { warehouse: Warehouse; expanded: boolean; onToggle: () => void }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

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

  const getStockColor = (quantity: number) => {
    if (quantity > 0) return 'success.main'
    if (quantity < 0) return 'error.main'
    return 'text.secondary'
  }

  const getOperationTypeLabel = (type: string) => {
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

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Header - Always visible */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: 'action.hover',
          '&:hover': {
            bgcolor: 'action.selected'
          }
        }}
        onClick={onToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <WarehouseIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {warehouse.warehouse_name}
              {warehouse.warehouse_code && ` (${warehouse.warehouse_code})`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                Készleten: <strong style={{ color: getStockColor(warehouse.quantity_on_hand) }}>
                  {warehouse.quantity_on_hand.toFixed(2)}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Elérhető: <strong style={{ color: getStockColor(warehouse.quantity_available) }}>
                  {warehouse.quantity_available.toFixed(2)}
                </strong>
              </Typography>
              {warehouse.quantity_reserved > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Foglalt: <strong>{warehouse.quantity_reserved.toFixed(2)}</strong>
                </Typography>
              )}
              {warehouse.total_value > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Érték: <strong>{formatCurrency(warehouse.total_value)}</strong>
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Collapsible Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Incoming Shipments */}
          {warehouse.incoming.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="success" fontSize="small" />
                Beérkező szállítmányok
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Szállítmányszám</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Várható mennyiség</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Beérkezett</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Hátralévő</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Várható érkezés</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {warehouse.incoming.map((shipment) => (
                      <TableRow key={shipment.shipment_id}>
                        <TableCell>
                          <MuiLink
                            component={NextLink}
                            href={`/shipments/${shipment.shipment_id}`}
                            sx={{ textDecoration: 'none', fontWeight: 500 }}
                          >
                            {shipment.shipment_number}
                          </MuiLink>
                        </TableCell>
                        <TableCell align="right">{shipment.expected_quantity.toFixed(2)}</TableCell>
                        <TableCell align="right">{shipment.received_quantity.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={shipment.pending_quantity.toFixed(2)}
                            size="small"
                            color="warning"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          {shipment.expected_arrival_date
                            ? formatDate(shipment.expected_arrival_date)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Warehouse Operations */}
          {warehouse.warehouse_operations.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <InventoryIcon color="primary" fontSize="small" />
                Kapcsolódó raktári műveletek
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Műveletszám</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Típus</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Státusz</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Dátum</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {warehouse.warehouse_operations.map((op) => (
                      <TableRow key={op.id} hover>
                        <TableCell>
                          <MuiLink
                            component={NextLink}
                            href={`/warehouse-operations/${op.id}`}
                            sx={{ textDecoration: 'none', fontWeight: 500 }}
                          >
                            {op.operation_number}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getOperationTypeLabel(op.operation_type)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(op.status)}
                            color={getStatusColor(op.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(op.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {warehouse.incoming.length === 0 && warehouse.warehouse_operations.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Nincs beérkező szállítmány vagy raktári művelet.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

export default function ProductInventoryTab({ productId }: ProductInventoryTabProps) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set())
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsLimit] = useState(20)
  const [movementsTotal, setMovementsTotal] = useState(0)
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', movementsPage.toString())
        params.set('limit', movementsLimit.toString())
        if (warehouseFilter !== 'all') params.set('warehouse_id', warehouseFilter)
        if (movementTypeFilter !== 'all') params.set('movement_type', movementTypeFilter)

        const response = await fetch(`/api/products/${productId}/inventory?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch inventory')

        const data = await response.json()
        setSummary(data.summary)
        setWarehouses(data.warehouses || [])
        setStockMovements(data.stock_movements || [])
        setMovementsTotal(data.pagination?.total || 0)
      } catch (error) {
        console.error('Error fetching inventory:', error)
        toast.error('Hiba a leltár adatok lekérdezésekor')
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [productId, movementsPage, movementsLimit, warehouseFilter, movementTypeFilter])

  const handleWarehouseToggle = (warehouseId: string) => {
    setExpandedWarehouses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(warehouseId)) {
        newSet.delete(warehouseId)
      } else {
        newSet.add(warehouseId)
      }
      return newSet
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Grid container spacing={3}>
      {/* Summary Card */}
      {summary && (
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#2196f3',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: '8px',
                  bgcolor: '#2196f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <InventoryIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Készlet összesítő
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Összes készleten
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: getQuantityColor(summary.total_on_hand)
                    }}
                  >
                    {summary.total_on_hand.toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Összes elérhető
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: getQuantityColor(summary.total_available)
                    }}
                  >
                    {summary.total_available.toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
              {summary.total_reserved > 0 && (
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Összes foglalt
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      {summary.total_reserved.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              )}
              {(summary.total_incoming ?? 0) > 0 && (
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Érkezik
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {(summary.total_incoming ?? 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              )}
              {summary.total_value > 0 && (
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Összes érték
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {formatCurrency(summary.total_value)}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      )}

      {/* Warehouses */}
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Raktárak szerinti készlet
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {warehouses.length === 0 ? (
            <Alert severity="info">
              Nincs készlet információ ehhez a termékhez.
            </Alert>
          ) : (
            warehouses.map((warehouse) => (
              <WarehouseInventoryCard
                key={warehouse.warehouse_id}
                warehouse={warehouse}
                expanded={expandedWarehouses.has(warehouse.warehouse_id)}
                onToggle={() => handleWarehouseToggle(warehouse.warehouse_id)}
              />
            ))
          )}
        </Box>
      </Grid>

      {/* Stock Movements Table */}
      <Grid item xs={12}>
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Készletmozgások
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Raktár</InputLabel>
                <Select
                  value={warehouseFilter}
                  label="Raktár"
                  onChange={(e) => {
                    setWarehouseFilter(e.target.value)
                    setMovementsPage(1)
                  }}
                >
                  <MenuItem value="all">Összes</MenuItem>
                  {warehouses.map((w) => (
                    <MenuItem key={w.warehouse_id} value={w.warehouse_id}>
                      {w.warehouse_name} {w.warehouse_code && `(${w.warehouse_code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Mozgás típusa</InputLabel>
                <Select
                  value={movementTypeFilter}
                  label="Mozgás típusa"
                  onChange={(e) => {
                    setMovementTypeFilter(e.target.value)
                    setMovementsPage(1)
                  }}
                >
                  <MenuItem value="all">Összes</MenuItem>
                  <MenuItem value="in">Be</MenuItem>
                  <MenuItem value="out">Ki</MenuItem>
                  <MenuItem value="transfer_in">Átszállítás be</MenuItem>
                  <MenuItem value="transfer_out">Átszállítás ki</MenuItem>
                  <MenuItem value="adjustment">Kiigazítás</MenuItem>
                  <MenuItem value="reserved">Foglalt</MenuItem>
                  <MenuItem value="released">Felszabadított</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {stockMovements.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nincs készletmozgás.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Dátum</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Raktár</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Mozgás típusa</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Mennyiség</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Egységár</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Összesen</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Forrás</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockMovements.map((movement) => {
                      const quantity = parseFloat(movement.quantity.toString())
                      const unitCost = movement.unit_cost ? parseFloat(movement.unit_cost.toString()) : null
                      const total = unitCost ? Math.abs(quantity) * unitCost : null
                      const sourceNode =
                        movement.warehouse_operations ? (
                          <MuiLink
                            component={NextLink}
                            href={`/warehouse-operations/${movement.warehouse_operation_id}`}
                            sx={{ textDecoration: 'none', fontWeight: 500 }}
                          >
                            {movement.warehouse_operations.operation_number}
                          </MuiLink>
                        ) : movement.source_type === 'order' && movement.source_id ? (
                          <MuiLink
                            component={NextLink}
                            href={`/orders/${movement.source_id}`}
                            sx={{ textDecoration: 'none', fontWeight: 500 }}
                          >
                            {movement.source_order_number ? `Rendelés #${movement.source_order_number}` : 'Rendelés'}
                          </MuiLink>
                        ) : (
                          '-'
                        )

                      return (
                        <TableRow key={movement.id} hover>
                          <TableCell sx={{ py: 1 }}>{formatDate(movement.created_at)}</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {movement.warehouses?.name || '-'}
                            {movement.warehouses?.code && ` (${movement.warehouses.code})`}
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <MovementTypeChip type={movement.movement_type} />
                          </TableCell>
                          <TableCell
                            sx={{
                              py: 1,
                              textAlign: 'right',
                              fontWeight: 600,
                              color: getQuantityColor(quantity)
                            }}
                          >
                            {quantity > 0 ? '+' : ''}{quantity.toFixed(2)}
                          </TableCell>
                          <TableCell sx={{ py: 1, textAlign: 'right' }}>
                            {unitCost ? formatCurrency(unitCost) : '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1, textAlign: 'right', fontWeight: 600 }}>
                            {total ? formatCurrency(total) : '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {sourceNode}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {Math.ceil(movementsTotal / movementsLimit) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <Pagination
                    count={Math.ceil(movementsTotal / movementsLimit)}
                    page={movementsPage}
                    onChange={(_e, page) => setMovementsPage(page)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Paper>
      </Grid>
    </Grid>
  )
}
