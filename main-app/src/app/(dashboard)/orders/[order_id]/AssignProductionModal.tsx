'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'
import { toast } from 'react-toastify'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface Machine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
  created_at?: string
}

interface AssignProductionModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  orderNumber: string
  machines: Machine[]
  existingAssignment?: {
    production_machine_id: string | null
    production_date: string | null
    barcode: string | null
  } | null
  onSuccess: () => void
}

export default function AssignProductionModal({
  open,
  onClose,
  quoteId,
  orderNumber,
  machines,
  existingAssignment,
  onSuccess
}: AssignProductionModalProps) {
  
  // Sort machines: Machine 3 (used_boards = 0, usage < 65%) should be at index 0
  // Then Machine 1 (large panels), then Machine 2 (small panels)
  // For now, we'll use the machine name or comment to identify Machine 3
  // If "Gyuri" is the machine for small orders, put it first
  const sortedMachines = useMemo(() => {
    return [...machines].sort((a, b) => {
      // Machine 3 (for used_boards = 0, usage < 65%) should be first
      // Check if machine name contains "Gyuri" or similar identifier
      const aIsMachine3 = a.machine_name.toLowerCase().includes('gyuri') || 
                          (a.comment && a.comment.toLowerCase().includes('kis rendelés'))
      const bIsMachine3 = b.machine_name.toLowerCase().includes('gyuri') || 
                          (b.comment && b.comment.toLowerCase().includes('kis rendelés'))
      
      if (aIsMachine3 && !bIsMachine3) return -1
      if (!aIsMachine3 && bIsMachine3) return 1
      
      // For other machines, sort by created_at
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return a.id.localeCompare(b.id)
    })
  }, [machines])
  
  const [machineId, setMachineId] = useState<string>('')
  const [productionDate, setProductionDate] = useState<Date | null>(null)
  const [barcode, setBarcode] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestedMachineId, setSuggestedMachineId] = useState<string | null>(null)
  const [suggestionReason, setSuggestionReason] = useState<string>('')
  const [m2PerPanel, setM2PerPanel] = useState<number | null>(null)
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  const [machineThreshold, setMachineThreshold] = useState<number>(0.35) // Default threshold

  // Calculate next business day (skip weekends)
  const getNextBusinessDay = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dayOfWeek = tomorrow.getDay()
    
    // If Saturday (6), add 2 days to get Monday
    if (dayOfWeek === 6) {
      tomorrow.setDate(tomorrow.getDate() + 2)
    }
    // If Sunday (0), add 1 day to get Monday
    else if (dayOfWeek === 0) {
      tomorrow.setDate(tomorrow.getDate() + 1)
    }
    // If Friday (5), add 3 days to get Monday
    else if (dayOfWeek === 5) {
      tomorrow.setDate(tomorrow.getDate() + 3)
    }
    
    return tomorrow
  }

  // Fetch machine threshold from settings
  useEffect(() => {
    const fetchThreshold = async () => {
      try {
        // Use getCuttingFee from server-side, but we need to fetch via API
        // Since we don't have a direct API endpoint, we'll use the existing cutting fee data
        // For now, we'll fetch it from the opti-settings page data or use default
        // Actually, let's use the getCuttingFee function result from the page
        // But since this is client-side, we need an API endpoint
        // Let's create a simple fetch to get the cutting fee
        const response = await fetch('/api/cutting-fees/current')
        if (response.ok) {
          const data = await response.json()
          if (data && data.machine_threshold !== null && data.machine_threshold !== undefined) {
            setMachineThreshold(parseFloat(data.machine_threshold))
          }
        }
      } catch (err) {
        console.error('Error fetching machine threshold:', err)
        // Use default if fetch fails
        setMachineThreshold(0.35)
      }
    }
    if (open) {
      fetchThreshold()
    }
  }, [open])

  // Calculate machine suggestion based on panels and pricing
  const calculateMachineSuggestion = useCallback(async () => {
    if (!open || !quoteId || sortedMachines.length < 3) return

    setIsLoadingSuggestion(true)
    try {
      // Fetch threshold first (or use current state if already fetched)
      let threshold = machineThreshold
      try {
        // Add cache-busting query parameter and headers
        const thresholdResponse = await fetch(`/api/cutting-fees/current?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        })
        if (thresholdResponse.ok) {
          const thresholdData = await thresholdResponse.json()
          console.log('Fetched threshold from API:', thresholdData.machine_threshold)
          if (thresholdData && thresholdData.machine_threshold !== null && thresholdData.machine_threshold !== undefined) {
            threshold = parseFloat(thresholdData.machine_threshold)
            setMachineThreshold(threshold) // Update state for next time
          }
        } else {
          console.error('Failed to fetch threshold, status:', thresholdResponse.status)
        }
      } catch (err) {
        console.error('Error fetching threshold, using current state:', err, 'Current threshold:', machineThreshold)
        // Use current state value
      }

      // Fetch quote data with panels and pricing
      const response = await fetch(`/api/quotes/${quoteId}`)
      if (!response.ok) {
        console.error('Failed to fetch quote data for suggestion')
        return
      }

      const quoteData = await response.json()
      const panels = quoteData.panels || []
      const pricing = quoteData.pricing || []

      if (panels.length === 0 || pricing.length === 0) {
        return
      }

      // Group panels by material_id and count total panels per material
      const panelsByMaterial = new Map<string, number>()
      panels.forEach((panel: any) => {
        const materialId = panel.material_id
        const currentCount = panelsByMaterial.get(materialId) || 0
        panelsByMaterial.set(materialId, currentCount + (panel.quantity || 1))
      })

      // Calculate metrics for each material
      const materialMetrics = pricing.map((p: any) => {
        const panelCount = panelsByMaterial.get(p.material_id) || 0
        const boardAreaM2 = (p.board_width_mm * p.board_length_mm) / 1000000 // Convert mm² to m²
        const totalMaterialArea = (boardAreaM2 * p.boards_used) + (p.charged_sqm || 0)
        const actualMaterialUsed = totalMaterialArea / (p.waste_multi || 1)
        
        return {
          material_id: p.material_id,
          panelCount,
          boards_used: p.boards_used,
          charged_sqm: p.charged_sqm || 0,
          usage_percentage: p.usage_percentage || 0,
          waste_multi: p.waste_multi || 1,
          boardAreaM2,
          totalMaterialArea,
          actualMaterialUsed
        }
      })

      const materialCount = materialMetrics.length
      const totalBoardsUsed = materialMetrics.reduce((sum, m) => sum + m.boards_used, 0)

      // Machine 3 (index 0): Single material, no boards, usage < 65%
      if (materialCount === 1) {
        const material = materialMetrics[0]
        if (material.boards_used === 0 && material.usage_percentage < 65) {
          setSuggestedMachineId(sortedMachines[0]?.id || null)
          setSuggestionReason(`1 anyag, 0 tábla, ${material.usage_percentage.toFixed(1)}% használat`)
          setM2PerPanel(null)
          return
        }
      }

      // Calculate m² per panel
      let calculatedM2PerPanel: number | null = null

      if (materialCount > 1) {
        // Multiple materials: sum everything
        const totalActualArea = materialMetrics.reduce((sum, m) => sum + m.actualMaterialUsed, 0)
        const totalPanels = materialMetrics.reduce((sum, m) => sum + m.panelCount, 0)
        calculatedM2PerPanel = totalPanels > 0 ? totalActualArea / totalPanels : null
      } else {
        // Single material
        const material = materialMetrics[0]
        // Machine 3 case is already handled above (boards_used === 0 && usage_percentage < 65)
        // For all other cases (including boards_used === 1), calculate m²/panel
        calculatedM2PerPanel = material.panelCount > 0 
          ? material.actualMaterialUsed / material.panelCount 
          : null
      }

      setM2PerPanel(calculatedM2PerPanel)

      // Decide Machine 1 or 2 based on m² per panel (using threshold from settings)
      if (calculatedM2PerPanel !== null) {
        console.log('Comparison: m²/panel =', calculatedM2PerPanel, 'threshold =', threshold, 'result:', calculatedM2PerPanel > threshold ? 'Machine 2' : 'Machine 1')
        if (calculatedM2PerPanel > threshold) {
          // Machine 2 (index 2): Large panels (few per board)
          setSuggestedMachineId(sortedMachines[2]?.id || null)
          setSuggestionReason(`${calculatedM2PerPanel.toFixed(4)} m²/panel átlag (nagy panelek)`)
        } else {
          // Machine 1 (index 1): Small panels (many per board)
          setSuggestedMachineId(sortedMachines[1]?.id || null)
          setSuggestionReason(`${calculatedM2PerPanel.toFixed(4)} m²/panel átlag (nagy panelek)`)
        }
      } else {
        // Fallback to Machine 1 if calculation fails
        setSuggestedMachineId(sortedMachines[1]?.id || null)
        setSuggestionReason('Alapértelmezett ajánlás')
      }

    } catch (err) {
      console.error('Error calculating machine suggestion:', err)
    } finally {
      setIsLoadingSuggestion(false)
    }
  }, [open, quoteId, sortedMachines, machineThreshold])

  const isEditMode = existingAssignment && existingAssignment.production_machine_id

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (existingAssignment && existingAssignment.production_machine_id) {
        // Edit mode: populate with existing values
        setMachineId(existingAssignment.production_machine_id)
        setProductionDate(existingAssignment.production_date ? new Date(existingAssignment.production_date) : getNextBusinessDay())
        setBarcode(existingAssignment.barcode || '')
      } else {
        // New assignment: default values
        setMachineId('')
        setProductionDate(getNextBusinessDay())
        setBarcode('')
        // Calculate suggestion for new assignments
        calculateMachineSuggestion()
      }
      setError(null)
    } else {
      // Reset suggestion when modal closes
      setSuggestedMachineId(null)
      setSuggestionReason('')
      setM2PerPanel(null)
    }
  }, [open, existingAssignment, calculateMachineSuggestion])

  // Auto-select suggested machine when suggestion is calculated
  useEffect(() => {
    if (!isEditMode && suggestedMachineId && !machineId && sortedMachines.find(m => m.id === suggestedMachineId)) {
      setMachineId(suggestedMachineId)
    }
  }, [suggestedMachineId, isEditMode, machineId, sortedMachines])

  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö'
  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö', 'Z' -> 'Y'
  const normalizeBarcode = (input: string): string => {
    const charMap: Record<string, string> = {
      'ü': '-',
      'ö': '0',
      'Y': 'Z'  // Hungarian keyboard: scanner sends Z but OS shows Y
    }
    return input
      .split('')
      .map(char => charMap[char] || char)
      .join('')
  }

  const handleSubmit = async () => {
    // Validation
    if (!machineId) {
      setError('Kérjük, válassz gépet!')
      return
    }

    if (!productionDate) {
      setError('Kérjük, válassz gyártási dátumot!')
      return
    }

    if (!barcode || !barcode.trim()) {
      setError('Kérjük, add meg a vonalkódot!')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/production`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          production_machine_id: machineId,
          production_date: productionDate.toISOString().split('T')[0], // YYYY-MM-DD
          barcode: barcode.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a gyártásba adás során')
      }

      toast.success(isEditMode ? 'Gyártás sikeresen módosítva!' : 'Megrendelés sikeresen gyártásba adva!')
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error('Production assignment error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a gyártásba adás során!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd a gyártás hozzárendelést?')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/production`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a gyártás törlése során')
      }

      toast.success('Gyártás hozzárendelés törölve!')
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error('Production delete error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a gyártás törlése során!')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={isSubmitting || isDeleting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isEditMode ? 'Gyártás módosítása' : 'Gyártásba adás'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Order Info */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Megrendelés: <strong>{orderNumber}</strong>
            </Typography>
          </Box>

          {/* Machine Selection */}
          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>Gép</InputLabel>
            <Select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              label="Gép"
            >
              {sortedMachines.map((machine) => {
                const isSuggested = !isEditMode && suggestedMachineId === machine.id
                return (
                  <MenuItem 
                    key={machine.id} 
                    value={machine.id}
                    sx={{
                      backgroundColor: isSuggested ? 'action.selected' : 'transparent',
                      '&:hover': {
                        backgroundColor: isSuggested ? 'action.hover' : 'action.hover'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      {isSuggested && (
                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        {machine.machine_name}
                        {machine.comment && ` (${machine.comment})`}
                      </Box>
                    </Box>
                  </MenuItem>
                )
              })}
            </Select>
            {!isEditMode && suggestedMachineId && !isLoadingSuggestion && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Ajánlás"
                  color="success"
                  size="small"
                  sx={{ height: '24px' }}
                />
                <Typography variant="caption" color="text.secondary">
                  <strong>{sortedMachines.find(m => m.id === suggestedMachineId)?.machine_name}</strong>
                </Typography>
                {m2PerPanel !== null && (
                  <Typography variant="caption" color="text.secondary">
                    • {m2PerPanel.toFixed(2)} m²/panel
                  </Typography>
                )}
                {suggestionReason && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    ({suggestionReason})
                  </Typography>
                )}
              </Box>
            )}
            {!isEditMode && isLoadingSuggestion && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Ajánlás számítása...
                </Typography>
              </Box>
            )}
          </FormControl>

          {/* Production Date */}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
            <DatePicker
              label="Gyártás dátuma *"
              value={productionDate}
              onChange={(newValue) => setProductionDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: { mb: 2 }
                }
              }}
            />
          </LocalizationProvider>

          {/* Barcode */}
          <TextField
            fullWidth
            label="Vonalkód"
            value={barcode}
            onChange={(e) => setBarcode(normalizeBarcode(e.target.value))}
            placeholder="Vonalkód beolvasása vagy megadása"
            required
            sx={{ mb: 2 }}
            helperText="Fizikai vonalkód leolvasó használata ajánlott"
            autoFocus
          />

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          {isEditMode && (
            <Button
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              color="error"
              startIcon={isDeleting && <CircularProgress size={16} />}
            >
              {isDeleting ? 'Törlés...' : 'Gyártás törlése'}
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
          >
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || isDeleting}
            startIcon={isSubmitting && <CircularProgress size={16} />}
            color="warning"
          >
            {isSubmitting ? 'Mentés...' : isEditMode ? 'Módosítás' : 'Gyártásba adás'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

