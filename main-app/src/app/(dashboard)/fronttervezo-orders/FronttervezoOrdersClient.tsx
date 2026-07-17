'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Pagination,
  Chip,
  FormControl,
  Select,
  MenuItem
} from '@mui/material'
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import PaymentConfirmationModal from '../scanner/PaymentConfirmationModal'
import SmsConfirmationModal from '../scanner/SmsConfirmationModal'
import DeleteConfirmationModal from '../orders/DeleteConfirmationModal'
import ArrivalDateModal from './ArrivalDateModal'
import {
  printFronttervezoReceipt,
  requestFronttervezoUsbPrinter
} from '@/lib/print-fronttervezo-receipt'

export type FronttervezoOrderRow = {
  id: string
  quote_number: string
  order_number: string
  status: string
  payment_status: string
  customer_name: string
  final_total: number
  total_paid?: number
  remaining_balance?: number
  barcode: string
  expected_arrival_date: string | null
  actual_arrival_date: string | null
  updated_at: string
}

interface Props {
  initialOrders: FronttervezoOrderRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize: number
}

function statusLabel(status: string) {
  switch (status) {
    case 'ordered':
      return 'Megrendelve'
    case 'ready':
      return 'Beérkezett'
    case 'finished':
      return 'Átadva'
    case 'cancelled':
      return 'Törölve'
    default:
      return status
  }
}

function statusColor(
  status: string
): 'default' | 'error' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'ordered':
      return 'success'
    case 'ready':
      return 'info'
    case 'finished':
      return 'default'
    case 'cancelled':
      return 'error'
    default:
      return 'default'
  }
}

function paymentLabel(status: string) {
  if (status === 'paid') return 'Kifizetve'
  if (status === 'partial') return 'Részben fizetve'
  return 'Nincs fizetve'
}

function paymentColor(status: string): 'error' | 'warning' | 'success' {
  if (status === 'paid') return 'success'
  if (status === 'partial') return 'warning'
  return 'error'
}

/** Várható vs tényleges / mai nap: on-time / late / pending / overdue */
type ArrivalTone = 'ok' | 'late' | 'pending' | 'overdue' | 'neutral'

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getArrivalTone(
  expected: string | null | undefined,
  actual: string | null | undefined
): ArrivalTone {
  const exp = toDateOnly(expected)
  if (!exp) return 'neutral'

  const act = toDateOnly(actual)
  if (act) {
    return act <= exp ? 'ok' : 'late'
  }

  const today = todayIsoDate()
  return today <= exp ? 'pending' : 'overdue'
}

function arrivalChipColor(tone: ArrivalTone): 'success' | 'error' | 'warning' | 'default' {
  switch (tone) {
    case 'ok':
      return 'success'
    case 'late':
    case 'overdue':
      return 'error'
    case 'pending':
      return 'warning'
    default:
      return 'default'
  }
}

export default function FronttervezoOrdersClient({
  initialOrders,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize
}: Props) {
  const router = useRouter()
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/fronttervezo-orders')

  const [orders, setOrders] = useState(initialOrders)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'ordered')
  const [pageSize, setPageSize] = useState(initialPageSize || 50)
  const [deleteSoftDialogOpen, setDeleteSoftDialogOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<
    Array<{
      id: string
      order_number: string
      customer_name: string
      customer_mobile: string
    }>
  >([])
  const [pendingArrivalDate, setPendingArrivalDate] = useState<string | null>(null)
  const [pendingUsbDevice, setPendingUsbDevice] = useState<USBDevice | null>(null)
  const [pendingPrintOrders, setPendingPrintOrders] = useState<FronttervezoOrderRow[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const skipSearchNav = useRef(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setOrders(initialOrders)
    setSelectedOrders([])
  }, [initialOrders])

  useEffect(() => {
    setStatusFilter(initialStatusFilter || 'ordered')
    setPageSize(initialPageSize || 50)
  }, [initialStatusFilter, initialPageSize])

  useEffect(() => {
    if (!mounted) return
    if (skipSearchNav.current) {
      skipSearchNav.current = false
      return
    }

    const timeoutId = setTimeout(() => {
      pushList(1, statusFilter, pageSize, searchTerm)
    }, 500)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search debounce only
  }, [searchTerm, mounted])

  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága a Front megrendelések oldal megtekintéséhez!')
        router.push('/home')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'

  const formatDate = (value: string | null) => {
    if (!value) return '—'
    const d = new Date(value.includes('T') ? value : `${value}T00:00:00`)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleDateString('hu-HU')
  }

  const pushList = (
    page: number,
    nextStatus = statusFilter,
    nextLimit = pageSize,
    nextSearch = searchTerm
  ) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', nextLimit.toString())
    params.set('status', nextStatus)
    if (nextSearch.trim()) {
      params.set('search', nextSearch.trim())
    }
    router.push(`/fronttervezo-orders?${params.toString()}`)
  }

  const handleStatusFilterChange = (next: string) => {
    setStatusFilter(next)
    pushList(1, next, pageSize)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedOrders(orders.map(o => o.id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    )
  }

  const handleBulkStatusUpdate = async (
    newStatus: 'ready' | 'finished' | 'cancelled',
    options?: {
      actual_arrival_date?: string
      create_payments?: boolean
      sms_order_ids?: string[]
    }
  ): Promise<boolean> => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return false
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/fronttervezo-orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedOrders,
          new_status: newStatus,
          actual_arrival_date: options?.actual_arrival_date,
          create_payments: options?.create_payments || false,
          sms_order_ids: options?.sms_order_ids || []
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Státusz frissítés sikertelen')
      }

      const label =
        newStatus === 'ready'
          ? 'Beérkezett'
          : newStatus === 'finished'
            ? 'Átadva'
            : 'Törölve'
      toast.success(
        `${data.updated_count || selectedOrders.length} megrendelés: ${label}` +
          (data.payments_created ? ` (${data.payments_created} fizetés rögzítve)` : '')
      )
      if (data.sms_notifications?.sent > 0) {
        toast.success(`${data.sms_notifications.sent} SMS elküldve`)
      }
      setSelectedOrders([])
      router.refresh()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Státusz frissítés sikertelen')
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  const PRINT_GAP_MS = 1000

  const printReceiptsForOrders = async (
    ordersToPrint: FronttervezoOrderRow[],
    usbDevice: USBDevice | null
  ) => {
    for (let i = 0; i < ordersToPrint.length; i++) {
      const order = ordersToPrint[i]
      if (ordersToPrint.length > 1) {
        toast.info(`Nyomtatás ${i + 1}/${ordersToPrint.length}: ${order.order_number}`, {
          autoClose: 4000
        })
      }
      try {
        await printFronttervezoReceipt({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          preferredUsbDevice: usbDevice
        })
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hiba történt a nyomtatás során'
        if (errorMessage.includes('not supported')) {
          toast.warning(
            'A böngésző nem támogatja a közvetlen USB nyomtatást. Kérjük, használja a Chrome vagy Edge böngészőt.'
          )
        } else if (
          errorMessage.includes('cancelled') ||
          errorMessage.includes('Nincs nyomtató')
        ) {
          toast.info(
            'Nyomtatás megszakítva vagy nincs nyomtató kiválasztva. A böngésző nyomtatási párbeszédablaka megnyílik.'
          )
        } else {
          toast.error(errorMessage)
        }
      }
      if (i < ordersToPrint.length - 1) {
        await new Promise(r => setTimeout(r, PRINT_GAP_MS))
      }
    }
  }

  const handleMarkAsReady = () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }
    setArrivalModalOpen(true)
  }

  const handleArrivalConfirm = async (arrivalDate: string) => {
    setPendingArrivalDate(arrivalDate)
    try {
      const response = await fetch('/api/fronttervezo-orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })
      if (!response.ok) throw new Error('SMS jogosultság ellenőrzés sikertelen')
      const result = await response.json()
      const eligible = result.sms_eligible_orders || []
      if (eligible.length > 0) {
        setSmsEligibleOrders(eligible)
        setSmsModalOpen(true)
      } else {
        await handleBulkStatusUpdate('ready', {
          actual_arrival_date: arrivalDate,
          sms_order_ids: []
        })
        setPendingArrivalDate(null)
      }
    } catch (err) {
      setPendingArrivalDate(null)
      throw err
    }
  }

  const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
    setSmsModalOpen(false)
    if (!pendingArrivalDate) return
    await handleBulkStatusUpdate('ready', {
      actual_arrival_date: pendingArrivalDate,
      sms_order_ids: selectedSmsOrderIds
    })
    setPendingArrivalDate(null)
  }

  const handleFinishedClick = async () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    const ordersToPrint = orders
      .filter(o => selectedOrders.includes(o.id))
      .map(o => ({ ...o }))
    const usbDevice = await requestFronttervezoUsbPrinter()

    const withBalance = ordersToPrint.filter(o => o.payment_status !== 'paid')

    if (withBalance.length === 0) {
      const ok = await handleBulkStatusUpdate('finished', { create_payments: false })
      if (ok) await printReceiptsForOrders(ordersToPrint, usbDevice)
      return
    }

    setPendingUsbDevice(usbDevice)
    setPendingPrintOrders(ordersToPrint)
    setPaymentModalOpen(true)
  }

  const handlePaymentConfirmation = async (createPayments: boolean) => {
    setPaymentModalOpen(false)
    const usbDevice = pendingUsbDevice
    const ordersToPrint = pendingPrintOrders
    setPendingUsbDevice(null)
    setPendingPrintOrders([])

    const ok = await handleBulkStatusUpdate('finished', { create_payments: createPayments })
    if (ok) await printReceiptsForOrders(ordersToPrint, usbDevice)
  }

  const handleCancelClick = () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }
    setCancelModalOpen(true)
  }

  const handleSoftDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/fronttervezo-quotes/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: selectedOrders })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || 'A törlés sikertelen')
        return
      }
      toast.success(`${selectedOrders.length} megrendelés törölve`)
      setSelectedOrders([])
      setDeleteSoftDialogOpen(false)
      router.refresh()
    } catch {
      toast.error('Váratlan hiba a törlés során')
    } finally {
      setIsDeleting(false)
    }
  }

  const isAllSelected = selectedOrders.length === orders.length && orders.length > 0
  const isIndeterminate = selectedOrders.length > 0 && selectedOrders.length < orders.length

  const unpaidSelected = orders
    .filter(o => selectedOrders.includes(o.id) && o.payment_status !== 'paid')
    .map(o => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      remaining_balance:
        o.remaining_balance ??
        Math.max(0, Math.round(o.final_total) - Math.round(o.total_paid || 0))
    }))

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a Front megrendelések oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Front megrendelések</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>
        Front megrendelések
      </Typography>

      {mounted && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            gap: 2,
            flexWrap: 'wrap'
          }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={pageSize}
              onChange={e => {
                const next = Number(e.target.value)
                setPageSize(next)
                pushList(1, statusFilter, next)
              }}
            >
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => setDeleteSoftDialogOpen(true)}
            disabled={selectedOrders.length === 0}
          >
            Törlés ({selectedOrders.length})
          </Button>
        </Box>
      )}

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        {(
          [
            ['all', 'Összes', 'primary'],
            ['ordered', 'Megrendelve', 'success'],
            ['ready', 'Beérkezett', 'info'],
            ['finished', 'Átadva', 'default'],
            ['cancelled', 'Törölve', 'error']
          ] as const
        ).map(([value, label, color]) => (
          <Chip
            key={value}
            label={label}
            onClick={() => handleStatusFilterChange(value)}
            color={statusFilter === value ? color : 'default'}
            variant={statusFilter === value ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      {selectedOrders.length > 0 && (
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            p: 2,
            bgcolor: 'primary.lighter',
            borderRadius: 1,
            flexWrap: 'wrap'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedOrders.length} kijelölve):
          </Typography>
          <Button
            variant="contained"
            color="info"
            startIcon={<CheckIcon />}
            onClick={handleMarkAsReady}
            disabled={isUpdating}
            size="small"
          >
            Beérkezett
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<DoneAllIcon />}
            onClick={handleFinishedClick}
            disabled={isUpdating}
            size="small"
          >
            Átadva
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleCancelClick}
            disabled={isUpdating}
            size="small"
          >
            Törölve
          </Button>
        </Box>
      )}

      <TextField
        fullWidth
        placeholder="Keresés ügyfél, megrendelésszám, vonalkód..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Megrendelés száma</TableCell>
              <TableCell>Ügyfél</TableCell>
              <TableCell align="right">Végösszeg</TableCell>
              <TableCell>Fizetési állapot</TableCell>
              <TableCell>Rendelés állapot</TableCell>
              <TableCell>Vonalkód</TableCell>
              <TableCell>Várható szállítás</TableCell>
              <TableCell>Tényleges beérkezés</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nincs megjeleníthető megrendelés.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map(order => {
                const arrivalTone = getArrivalTone(
                  order.expected_arrival_date,
                  order.actual_arrival_date
                )
                const chipColor = arrivalChipColor(arrivalTone)

                return (
                <TableRow
                  key={order.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/fronttervezo-orders/${order.id}`)}
                >
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {order.order_number}
                    </Typography>
                  </TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(order.final_total)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={paymentLabel(order.payment_status)}
                      color={paymentColor(order.payment_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabel(order.status)}
                      color={statusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {order.barcode || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {order.expected_arrival_date ? (
                      <Chip
                        label={formatDate(order.expected_arrival_date)}
                        color={chipColor}
                        size="small"
                        variant={arrivalTone === 'pending' ? 'outlined' : 'filled'}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.actual_arrival_date ? (
                      <Chip
                        label={formatDate(order.actual_arrival_date)}
                        color={chipColor}
                        size="small"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_e, page) => pushList(page)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      <ArrivalDateModal
        open={arrivalModalOpen}
        onClose={() => setArrivalModalOpen(false)}
        onConfirm={handleArrivalConfirm}
        orderCount={selectedOrders.length}
      />

      <SmsConfirmationModal
        open={smsModalOpen}
        onClose={() => {
          setSmsModalOpen(false)
          setPendingArrivalDate(null)
        }}
        onConfirm={handleSmsConfirmation}
        orders={smsEligibleOrders}
        isProcessing={isUpdating}
        description="A következő ügyfelek SMS értesítést kapnak a front rendelés beérkezéséről. Töröld a pipát, ha nem szeretnéd elküldeni az SMS-t."
      />

      <PaymentConfirmationModal
        open={paymentModalOpen}
        orders={unpaidSelected}
        onConfirm={handlePaymentConfirmation}
        onClose={() => {
          setPaymentModalOpen(false)
          setPendingUsbDevice(null)
          setPendingPrintOrders([])
        }}
      />

      <DeleteConfirmationModal
        open={cancelModalOpen}
        orderCount={selectedOrders.length}
        onConfirm={async () => {
          setCancelModalOpen(false)
          await handleBulkStatusUpdate('cancelled')
        }}
        onClose={() => setCancelModalOpen(false)}
      />

      <Dialog open={deleteSoftDialogOpen} onClose={() => setDeleteSoftDialogOpen(false)}>
        <DialogTitle>Megrendelések törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedOrders.length} megrendelést? Ez a
            művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSoftDialogOpen(false)} disabled={isDeleting}>
            Mégse
          </Button>
          <Button
            onClick={handleSoftDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
