'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Typography,
  Box
} from '@mui/material'
import { Notifications as NotificationsIcon } from '@mui/icons-material'

interface ReminderEligibleOrder {
  id: string
  order_number: string
  customer_name: string
  customer_mobile: string
}

interface StorageReminderModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (selectedOrderIds: string[]) => void
  orders: ReminderEligibleOrder[]
  isProcessing?: boolean
}

export default function StorageReminderModal({
  open,
  onClose,
  onConfirm,
  orders,
  isProcessing = false
}: StorageReminderModalProps) {
  // All checkboxes checked by default
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(() => orders.map(o => o.id))

  // Update selected orders when modal opens with new orders
  React.useEffect(() => {
    if (open) {
      setSelectedOrderIds(orders.map(o => o.id))
    }
  }, [open, orders])

  const handleToggle = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const handleConfirm = () => {
    onConfirm(selectedOrderIds)
  }

  const handleCancel = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isProcessing}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <NotificationsIcon color="warning" />
        Tárolási emlékeztető SMS küldése
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A következő ügyfelek emlékeztető SMS-t kapnak a rendelésük átvételéről.
          Töröld a pipát, ha nem szeretnéd elküldeni az SMS-t egy adott ügyfélnek.
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 50 }}>
                  <Checkbox
                    checked={selectedOrderIds.length === orders.length && orders.length > 0}
                    indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(orders.map(o => o.id))
                      } else {
                        setSelectedOrderIds([])
                      }
                    }}
                    disabled={isProcessing}
                  />
                </TableCell>
                <TableCell><strong>Ügyfél neve</strong></TableCell>
                <TableCell><strong>Telefonszám</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  hover
                  onClick={() => !isProcessing && handleToggle(order.id)}
                  sx={{ cursor: isProcessing ? 'default' : 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={(e) => {
                        e.stopPropagation() // Prevent row click from firing
                        handleToggle(order.id)
                      }}
                      onClick={(e) => e.stopPropagation()} // Also stop click propagation
                      disabled={isProcessing}
                    />
                  </TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{order.customer_mobile}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {selectedOrderIds.length === 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.dark">
              ⚠️ Nincs kiválasztva egyetlen ügyfél sem. Emlékeztető SMS nem lesz küldve.
            </Typography>
          </Box>
        )}

        {selectedOrderIds.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
            <Typography variant="body2" color="info.dark">
              📱 {selectedOrderIds.length} emlékeztető SMS lesz elküldve
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={isProcessing}
          color="inherit"
        >
          Mégse
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={isProcessing}
          startIcon={isProcessing ? undefined : <NotificationsIcon />}
        >
          {isProcessing ? 'Feldolgozás...' : 'Emlékeztető küldés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

