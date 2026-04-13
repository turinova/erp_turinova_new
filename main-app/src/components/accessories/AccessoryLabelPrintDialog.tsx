'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import dynamic from 'next/dynamic'

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography
} from '@mui/material'
import { Print as PrintIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

/** Payload from GET /api/accessories/[id] (flattened joins). */
export type AccessoryLabelPrintPayload = {
  id: string
  name: string
  sku: string
  barcode?: string | null
  barcode_u?: string | null
  base_price: number
  multiplier: number
  net_price: number
  gross_price?: number | null
  vat_percent?: number
  unit_shortform?: string
}

type LabelFieldsState = {
  showName: boolean
  showSku: boolean
  showBarcode: boolean
  showPrice: boolean
}

function sellingPriceFromPayload(a: AccessoryLabelPrintPayload): number {
  if (a.gross_price !== undefined && a.gross_price !== null && Number.isFinite(Number(a.gross_price))) {
    return Number(a.gross_price)
  }
  const basePrice = a.base_price || 0
  const multiplier = parseFloat(String(a.multiplier)) || 1.38
  const vatPercent = a.vat_percent || 0
  const netPrice = basePrice * multiplier
  return Math.round(netPrice * (1 + vatPercent / 100))
}

/** Editable price wins when set (including 0 Ft); otherwise API-derived gross. */
function effectiveSellingPrice(editable: number | null, fallback: number | null): number {
  if (editable !== null && editable !== undefined) return editable
  return fallback ?? 0
}

type PrintLabelProps = {
  accessory: AccessoryLabelPrintPayload
  fields: LabelFieldsState
  price: number
  productName: string
  unitShortform: string
  size?: '33x25' | '64x39'
}

function PrintLabel({ accessory, fields, price, productName, unitShortform, size = '33x25' }: PrintLabelProps) {
  const scale = size === '64x39' ? 1.56 : 1
  const labelWidth = size === '64x39' ? '64mm' : '33mm'
  const labelHeight = size === '64x39' ? '39mm' : '25mm'
  const topPadding = size === '64x39' ? '2.34mm' : '1.5mm'
  const nameHeight = size === '64x39' ? '9.83mm' : '6.3mm'
  const skuHeight = size === '64x39' ? '5.93mm' : '3.8mm'
  const priceHeight = size === '64x39' ? '10.14mm' : '6.5mm'
  const barcodeHeight = size === '64x39' ? '10.76mm' : '6.9mm'

  const text = productName || accessory.name || 'N/A'
  const baseNameFontSize = text.length > 25 ? 2.5 : 3.5
  const nameFontSize = `${(baseNameFontSize * scale).toFixed(2)}mm`
  const skuFontSize = `${(3.0 * scale).toFixed(2)}mm`

  const priceText = `${new Intl.NumberFormat('hu-HU').format(price)} Ft / ${unitShortform || 'db'}`
  const priceTextLength = priceText.length
  let basePriceFontSize = 6
  if (priceTextLength > 20) {
    basePriceFontSize = 4
  } else if (priceTextLength > 15) {
    basePriceFontSize = 4.5
  } else if (priceTextLength > 12) {
    basePriceFontSize = 5
  } else if (priceTextLength > 10) {
    basePriceFontSize = 5.5
  }
  const priceFontSize = `${(basePriceFontSize * scale).toFixed(2)}mm`
  const barcodeHeightPx = Math.round(50 * scale)

  const gridRows: string[] = []
  if (fields.showName) gridRows.push(nameHeight)
  if (fields.showSku && accessory.sku) gridRows.push(skuHeight)
  if (fields.showPrice) gridRows.push(priceHeight)
  if (fields.showBarcode && (accessory.barcode || accessory.barcode_u)) gridRows.push(barcodeHeight)

  return (
    <div
      style={{
        width: labelWidth,
        height: labelHeight,
        padding: `${topPadding} 0 0 0`,
        margin: 0,
        backgroundColor: 'white',
        display: 'grid',
        gridTemplateRows: gridRows.join(' '),
        gridTemplateColumns: '100%',
        gap: 0,
        rowGap: 0,
        columnGap: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {fields.showName && (
        <div
          style={{
            width: '100%',
            height: '100%',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
            lineHeight: 1.1
          }}
        >
          <div
            style={{
              fontSize: nameFontSize,
              fontWeight: 'bold',
              color: '#000000',
              lineHeight: 1.1,
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              maxWidth: '100%',
              textAlign: 'center',
              margin: 0,
              padding: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'normal',
              overflow: 'hidden'
            }}
          >
            {text}
          </div>
        </div>
      )}

      {fields.showSku && accessory.sku && (
        <div
          style={{
            width: '100%',
            height: '100%',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              fontSize: skuFontSize,
              color: '#000000',
              lineHeight: 1,
              margin: 0,
              padding: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
          >
            {accessory.sku}
          </div>
        </div>
      )}

      {fields.showPrice && (
        <div
          style={{
            width: '100%',
            height: '100%',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              fontSize: priceFontSize,
              fontWeight: 'bold',
              color: '#000000',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              margin: 0,
              padding: '0 1mm',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxSizing: 'border-box'
            }}
          >
            {priceText}
          </div>
        </div>
      )}

      {fields.showBarcode && (accessory.barcode || accessory.barcode_u) && (
        <div
          style={{
            width: '100%',
            height: '100%',
            alignSelf: 'stretch',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 0,
              margin: 0,
              overflow: 'hidden'
            }}
          >
            <Barcode
              value={accessory.barcode || accessory.barcode_u || ''}
              format="CODE128"
              width={2.5}
              height={barcodeHeightPx}
              fontSize={10}
              displayValue={false}
              margin={0}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export type AccessoryLabelPrintDialogProps = {
  open: boolean
  accessory: AccessoryLabelPrintPayload | null
  onClose: () => void
}

export default function AccessoryLabelPrintDialog({ open, accessory, onClose }: AccessoryLabelPrintDialogProps) {
  const [editableProductName, setEditableProductName] = useState('')
  const [editableSellingPrice, setEditableSellingPrice] = useState<number | null>(null)
  const [selectedUnitShortform, setSelectedUnitShortform] = useState('')
  const [units, setUnits] = useState<Array<{ id: string; name: string; shortform: string }>>([])
  const [labelFields, setLabelFields] = useState<LabelFieldsState>({
    showName: true,
    showSku: true,
    showBarcode: true,
    showPrice: true
  })
  const [printAmount, setPrintAmount] = useState(1)
  const [isPrinting, setIsPrinting] = useState(false)
  const [labelSize, setLabelSize] = useState<'33x25' | '64x39'>('33x25')

  const currentSellingPrice = useMemo(() => {
    if (!accessory) return null
    return sellingPriceFromPayload(accessory)
  }, [accessory])

  const resetDialogUi = useCallback(() => {
    setEditableProductName('')
    setEditableSellingPrice(null)
    setSelectedUnitShortform('')
    setUnits([])
    setLabelFields({
      showName: true,
      showSku: true,
      showBarcode: true,
      showPrice: true
    })
    setPrintAmount(1)
    setLabelSize('33x25')
  }, [])

  useEffect(() => {
    if (!open) {
      resetDialogUi()
    }
  }, [open, resetDialogUi])

  useEffect(() => {
    if (!open || !accessory) return

    setEditableProductName(accessory.name)
    setEditableSellingPrice(sellingPriceFromPayload(accessory))
    setSelectedUnitShortform(accessory.unit_shortform || '')
    setLabelFields({
      showName: true,
      showSku: true,
      showBarcode: !!(accessory.barcode || accessory.barcode_u),
      showPrice: true
    })
    setPrintAmount(1)
    setLabelSize('33x25')

    void (async () => {
      try {
        const unitsResponse = await fetch('/api/units')
        if (unitsResponse.ok) {
          const unitsData = await unitsResponse.json()
          setUnits(Array.isArray(unitsData) ? unitsData : [])
        }
      } catch (e) {
        console.error('Error fetching units:', e)
      }
    })()
  }, [open, accessory])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const displayPrice = useMemo(
    () => effectiveSellingPrice(editableSellingPrice, currentSellingPrice),
    [editableSellingPrice, currentSellingPrice]
  )

  const handlePrintLabel = async () => {
    if (!accessory) return

    if (!labelFields.showName && !labelFields.showSku && !labelFields.showBarcode && !labelFields.showPrice) {
      toast.error('Válasszon ki legalább egy mezőt a címkéhez!')
      return
    }

    setIsPrinting(true)
    try {
      const existingContainer = document.getElementById('label-print-container')
      if (existingContainer) {
        const root = (existingContainer as { _reactRootContainer?: { unmount: () => void } })._reactRootContainer
        if (root) root.unmount()
        document.body.removeChild(existingContainer)
      }
      const existingStyle = document.getElementById('label-print-styles')
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }

      const printContainer = document.createElement('div')
      printContainer.id = 'label-print-container'
      printContainer.style.position = 'absolute'
      printContainer.style.left = '-9999px'
      printContainer.style.top = '-9999px'
      document.body.appendChild(printContainer)

      const style = document.createElement('style')
      style.id = 'label-print-styles'
      style.textContent = `
        #label-print-container {
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          visibility: hidden !important;
        }
        @media print {
          @page {
            size: ${labelSize === '64x39' ? '64mm 39mm' : '33mm 25mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${labelSize === '64x39' ? '64mm' : '33mm'} !important;
            height: auto !important;
            background: white !important;
            overflow: visible !important;
          }
          body > *:not(#label-print-container) {
            display: none !important;
            visibility: hidden !important;
          }
          #label-print-container {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: ${labelSize === '64x39' ? '64mm' : '33mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 9999 !important;
          }
          #label-print-container > div {
            width: ${labelSize === '64x39' ? '64mm' : '33mm'} !important;
            height: ${labelSize === '64x39' ? '39mm' : '25mm'} !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: ${labelSize === '64x39' ? '2.34mm' : '1.5mm'} 0 0 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            display: grid !important;
            grid-auto-rows: 0 !important;
            grid-auto-flow: row !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
          }
          #label-print-container > div:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          #label-print-container *,
          #label-print-container *::before,
          #label-print-container *::after {
            margin: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-block: 0 !important;
            margin-block-start: 0 !important;
            margin-block-end: 0 !important;
            margin-inline: 0 !important;
            margin-inline-start: 0 !important;
            margin-inline-end: 0 !important;
            padding: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            border-spacing: 0 !important;
            border-collapse: collapse !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          #label-print-container div {
            color: #000000 !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          #label-print-container *::before,
          #label-print-container *::after {
            content: none !important;
            display: none !important;
            height: 0 !important;
            width: 0 !important;
          }
          #label-print-container div {
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            box-sizing: border-box !important;
            visibility: visible !important;
            opacity: 1 !important;
            color: #000000 !important;
          }
          #label-print-container > div {
            padding-top: ${labelSize === '64x39' ? '2.34mm' : '1.5mm'} !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            overflow: hidden !important;
          }
          #label-print-container > div > div > div {
            overflow: visible !important;
          }
          #label-print-container > div {
            display: grid !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            grid-auto-rows: 0 !important;
            min-height: 0 !important;
            max-height: 100% !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            padding-top: ${labelSize === '64x39' ? '2.34mm' : '1.5mm'} !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
          }
          #label-print-container > div > div {
            align-self: stretch !important;
            min-height: 0 !important;
            max-height: 100% !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
          }
          #label-print-container svg {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            vertical-align: bottom !important;
            align-self: flex-end !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: visible !important;
            object-fit: fill !important;
          }
          #label-print-container > div > div:last-child {
            align-items: flex-end !important;
          }
        }
      `
      document.head.appendChild(style)

      const root = createRoot(printContainer)
      const priceForPrint = displayPrice
      const labels = []
      for (let i = 0; i < printAmount; i++) {
        labels.push(
          <PrintLabel
            key={i}
            accessory={accessory}
            fields={labelFields}
            price={priceForPrint}
            productName={editableProductName}
            unitShortform={selectedUnitShortform || accessory.unit_shortform || 'db'}
            size={labelSize}
          />
        )
      }
      root.render(<>{labels}</>)
      ;(printContainer as { _reactRootContainer?: ReturnType<typeof createRoot> })._reactRootContainer = root

      await new Promise(resolve => setTimeout(resolve, 100))
      window.print()

      setTimeout(() => {
        try {
          const container = document.getElementById('label-print-container')
          if (container) {
            const rootRef = (container as { _reactRootContainer?: { unmount: () => void } })._reactRootContainer
            if (rootRef) rootRef.unmount()
            document.body.removeChild(container)
          }
          const styleEl = document.getElementById('label-print-styles')
          if (styleEl) document.head.removeChild(styleEl)
        } catch (e) {
          console.error('Cleanup error:', e)
        }
      }, 1000)
    } catch (error: unknown) {
      console.error('Print error:', error)
      toast.error('Hiba a nyomtatás során')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Dialog
      open={open && Boolean(accessory)}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="print-label-dialog-title"
    >
      <DialogTitle id="print-label-dialog-title">Címke nyomtatása</DialogTitle>
      <DialogContent>
        {accessory && (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 3,
                  backgroundColor: 'background.paper'
                }}
              >
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Termék neve
                    </Typography>
                    <TextField
                      label="Termék neve (szerkeszthető)"
                      value={editableProductName}
                      onChange={e => setEditableProductName(e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Megjelenítendő mezők
                    </Typography>
                    <FormGroup row sx={{ gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={labelFields.showName}
                            onChange={e => setLabelFields({ ...labelFields, showName: e.target.checked })}
                            size="small"
                          />
                        }
                        label="Termék neve"
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={labelFields.showSku}
                            onChange={e => setLabelFields({ ...labelFields, showSku: e.target.checked })}
                            size="small"
                          />
                        }
                        label="SKU"
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={labelFields.showBarcode}
                            onChange={e => setLabelFields({ ...labelFields, showBarcode: e.target.checked })}
                            disabled={!(accessory.barcode || accessory.barcode_u)}
                            size="small"
                          />
                        }
                        label="Vonalkód"
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={labelFields.showPrice}
                            onChange={e => setLabelFields({ ...labelFields, showPrice: e.target.checked })}
                            size="small"
                          />
                        }
                        label="Ár"
                        sx={{ m: 0 }}
                      />
                    </FormGroup>
                  </Grid>
                </Grid>

                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 3 }} />

                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Jelenlegi eladási ár
                    </Typography>
                    {editableSellingPrice !== null ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          flexWrap: 'wrap',
                          width: '100%'
                        }}
                      >
                        <TextField
                          type="number"
                          value={editableSellingPrice}
                          onChange={e => {
                            const value = parseInt(e.target.value, 10)
                            setEditableSellingPrice(Number.isNaN(value) ? 0 : value >= 0 ? value : 0)
                          }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">Ft</InputAdornment>,
                            sx: {
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              '& input': {
                                textAlign: 'right',
                                color: 'error.main',
                                fontWeight: 'bold'
                              }
                            }
                          }}
                          sx={{
                            width: '200px',
                            flexShrink: 0,
                            '& .MuiOutlinedInput-root': {
                              fontSize: '1.5rem',
                              fontWeight: 'bold'
                            }
                          }}
                        />
                        <Typography variant="h6" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                          /
                        </Typography>
                        <FormControl sx={{ minWidth: 120, flexShrink: 0 }}>
                          <Select
                            value={selectedUnitShortform}
                            onChange={e => setSelectedUnitShortform(e.target.value)}
                            displayEmpty
                            sx={{
                              fontSize: '1.5rem',
                              fontWeight: 'bold'
                            }}
                          >
                            {units.map(unit => (
                              <MenuItem key={unit.id} value={unit.shortform}>
                                {unit.shortform}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Box
                          sx={{
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            position: 'relative',
                            maxWidth: '100%'
                          }}
                        >
                          <Typography
                            variant="h4"
                            sx={{
                              color: 'error.main',
                              fontWeight: 'bold',
                              fontSize: '2rem',
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                              width: '100%',
                              transform: 'scale(1)',
                              transformOrigin: 'left center',
                              '@media (max-width: 1400px)': { fontSize: '1.75rem' },
                              '@media (max-width: 1200px)': { fontSize: '1.5rem' },
                              '@media (max-width: 1000px)': { fontSize: '1.25rem' },
                              '@media (max-width: 800px)': { fontSize: '1rem' },
                              '@media (max-width: 600px)': { fontSize: '0.875rem' }
                            }}
                          >
                            = {new Intl.NumberFormat('hu-HU').format(editableSellingPrice)} Ft /{' '}
                            {selectedUnitShortform || 'db'}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        Ár számítható
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 3 }} />

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Nyomtatandó mennyiség
                    </Typography>
                    <TextField
                      label="Mennyiség"
                      type="number"
                      value={printAmount}
                      onChange={e => setPrintAmount(Math.max(1, Number(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                      fullWidth
                      size="small"
                      helperText="Alapértelmezett: 1"
                      sx={{ maxWidth: '300px' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Címke mérete
                    </Typography>
                    <FormControl component="fieldset">
                      <RadioGroup row value={labelSize} onChange={e => setLabelSize(e.target.value as '33x25' | '64x39')}>
                        <FormControlLabel value="33x25" control={<Radio size="small" />} label="33mm × 25mm" />
                        <FormControlLabel value="64x39" control={<Radio size="small" />} label="64mm × 39mm" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ textAlign: 'center' }}>
                Előnézet ({labelSize === '64x39' ? '64mm × 39mm' : '33mm × 25mm'} - 2x nagyított):
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <div
                  style={{
                    width: labelSize === '64x39' ? '484px' : '250px',
                    height: labelSize === '64x39' ? '295px' : '189px',
                    border: '2px solid #ccc',
                    padding: `${labelSize === '64x39' ? (2.34 * 7.56).toFixed(2) : (1.5 * 7.56).toFixed(2)}px 0 0 0`,
                    margin: 0,
                    backgroundColor: 'white',
                    display: 'grid',
                    gridTemplateRows: (() => {
                      const scale = labelSize === '64x39' ? 1.56 : 1
                      const previewScale = 7.56
                      const rows: string[] = []
                      if (labelFields.showName) rows.push(`${(6.3 * scale * previewScale).toFixed(2)}px`)
                      if (labelFields.showSku && accessory.sku) rows.push(`${(3.8 * scale * previewScale).toFixed(2)}px`)
                      if (labelFields.showPrice) rows.push(`${(6.5 * scale * previewScale).toFixed(2)}px`)
                      if (labelFields.showBarcode && (accessory.barcode || accessory.barcode_u))
                        rows.push(`${(6.9 * scale * previewScale).toFixed(2)}px`)
                      return rows.join(' ')
                    })(),
                    gridTemplateColumns: '100%',
                    gap: 0,
                    rowGap: 0,
                    columnGap: 0,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    position: 'relative'
                  }}
                >
                  {labelFields.showName && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box',
                        lineHeight: 1.1
                      }}
                    >
                      <div
                        style={{
                          fontSize: (() => {
                            const text = editableProductName || accessory.name || ''
                            const scale = labelSize === '64x39' ? 1.56 : 1
                            const previewScale = 7.56
                            const baseFontSize = text.length > 25 ? 2.5 : 3.5
                            return `${(baseFontSize * scale * previewScale).toFixed(2)}px`
                          })(),
                          fontWeight: 'bold',
                          color: '#000000',
                          lineHeight: 1.1,
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                          textAlign: 'center',
                          margin: 0,
                          padding: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'normal',
                          overflow: 'hidden'
                        }}
                      >
                        {editableProductName || accessory.name}
                      </div>
                    </div>
                  )}
                  {labelFields.showSku && accessory.sku && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div
                        style={{
                          fontSize: (() => {
                            const scale = labelSize === '64x39' ? 1.56 : 1
                            const previewScale = 7.56
                            return `${(3.0 * scale * previewScale).toFixed(2)}px`
                          })(),
                          color: '#000000',
                          lineHeight: 1,
                          margin: 0,
                          padding: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden'
                        }}
                      >
                        {accessory.sku}
                      </div>
                    </div>
                  )}
                  {labelFields.showPrice && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div
                        style={{
                          fontSize: (() => {
                            const scale = labelSize === '64x39' ? 1.56 : 1
                            const previewScale = 7.56
                            const priceText = `${new Intl.NumberFormat('hu-HU').format(displayPrice)} Ft / ${selectedUnitShortform || accessory.unit_shortform || 'db'}`
                            const priceTextLength = priceText.length
                            let basePriceFontSize = 6
                            if (priceTextLength > 20) basePriceFontSize = 4
                            else if (priceTextLength > 15) basePriceFontSize = 4.5
                            else if (priceTextLength > 12) basePriceFontSize = 5
                            else if (priceTextLength > 10) basePriceFontSize = 5.5
                            return `${(basePriceFontSize * scale * previewScale).toFixed(2)}px`
                          })(),
                          fontWeight: 'bold',
                          color: '#000000',
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          margin: 0,
                          padding: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}
                      >
                        {new Intl.NumberFormat('hu-HU').format(displayPrice)} Ft /{' '}
                        {selectedUnitShortform || accessory.unit_shortform || 'db'}
                      </div>
                    </div>
                  )}
                  {labelFields.showBarcode && (accessory.barcode || accessory.barcode_u) && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        alignSelf: 'stretch',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        overflow: 'hidden',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          padding: 0,
                          margin: 0,
                          overflow: 'hidden'
                        }}
                      >
                        <Barcode
                          value={accessory.barcode || accessory.barcode_u || ''}
                          format="CODE128"
                          width={2.5}
                          height={(() => {
                            const scale = labelSize === '64x39' ? 1.56 : 1
                            return Math.round(32 * scale)
                          })()}
                          fontSize={10}
                          displayValue={false}
                          margin={0}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPrinting}>
          Mégse
        </Button>
        <Button
          onClick={handlePrintLabel}
          variant="contained"
          color="primary"
          disabled={isPrinting || !accessory}
          startIcon={isPrinting ? <CircularProgress size={18} /> : <PrintIcon />}
        >
          {isPrinting ? 'Nyomtatás...' : 'Nyomtatás'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
