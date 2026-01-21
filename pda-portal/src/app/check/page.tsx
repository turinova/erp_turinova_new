'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface AccessoryData {
  id: string
  name: string
  sku: string
  base_price: number
  multiplier: number
  net_price: number
  vat_id: string
  currency_id: string
  vat?: {
    id: string
    kulcs: number
  }
  currencies?: {
    id: string
    name: string
  }
}

export default function CheckPage() {
  const router = useRouter()
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [accessory, setAccessory] = useState<AccessoryData | null>(null)
  const [grossPrice, setGrossPrice] = useState<number>(0)
  const [calculatedMultiplier, setCalculatedMultiplier] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus barcode input
  useEffect(() => {
    const focusInput = () => {
      if (barcodeInputRef.current && !isScanning && !accessory) {
        barcodeInputRef.current.focus()
        barcodeInputRef.current.select()
      }
    }

    const timer = setTimeout(focusInput, 300)
    return () => clearTimeout(timer)
  }, [isScanning, accessory])

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode || !barcode.trim() || isScanning) {
      return
    }

    setIsScanning(true)
    const trimmedBarcode = barcode.trim()

    try {
      const response = await fetch(`/api/accessories/by-barcode?barcode=${encodeURIComponent(trimmedBarcode)}`)

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Kellék nem található')
        } else {
          toast.error('Hiba történt a keresés során')
        }
        setBarcodeInput('')
        setIsScanning(false)
        return
      }

      const product = await response.json()

      // Fetch full accessory data including base_price, multiplier, vat
      const accessoryResponse = await fetch(`/api/accessories/${product.accessory_id}`)
      if (!accessoryResponse.ok) {
        toast.error('Hiba történt a kellék adatok lekérése során')
        setBarcodeInput('')
        setIsScanning(false)
        return
      }

      const accessoryData: AccessoryData = await accessoryResponse.json()

      // Calculate current gross price
      const vatPercent = accessoryData.vat?.kulcs || 0
      const currentGrossPrice = accessoryData.net_price + ((accessoryData.net_price * vatPercent) / 100)

      setAccessory(accessoryData)
      setGrossPrice(Math.round(currentGrossPrice))
      setCalculatedMultiplier(accessoryData.multiplier)
      setBarcodeInput('')
    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Hiba történt')
      setBarcodeInput('')
    } finally {
      setIsScanning(false)
    }
  }

  // Handle barcode input change (debounced for scanner)
  const handleBarcodeInputChange = (value: string) => {
    setBarcodeInput(value)

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = value.trim()
      if (trimmedValue.length > 0 && !isScanning) {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Handle gross price change (same logic as accessories edit page)
  const handleGrossPriceChange = (grossPriceValue: number) => {
    if (!accessory) return

    const vatPercent = accessory.vat?.kulcs || 0
    if (vatPercent > 0 && grossPriceValue > 0 && accessory.base_price > 0) {
      // Számlázz.hu pattern: Round gross to integer first
      const roundedGrossPrice = Math.round(grossPriceValue)

      // Calculate VAT from gross: VAT = gross / (100 + VAT_rate) × VAT_rate
      const vatAmountPrecise = roundedGrossPrice / (100 + vatPercent) * vatPercent
      const vatAmount = Math.round(vatAmountPrecise) // Round VAT to integer

      // Calculate net: net = gross - VAT (both integers, result is integer)
      const netPrice = roundedGrossPrice - vatAmount

      // Calculate multiplier from net_price and base_price
      const multiplier = netPrice / accessory.base_price

      setGrossPrice(roundedGrossPrice)
      setCalculatedMultiplier(Math.round(multiplier * 100) / 100) // Round to 2 decimals
    } else if (grossPriceValue > 0) {
      // If base_price is 0 or no VAT, just update gross price
      setGrossPrice(Math.round(grossPriceValue))
    } else {
      // Reset if gross_price is 0
      setGrossPrice(0)
      setCalculatedMultiplier(accessory.multiplier)
    }
  }

  // Handle save
  const handleSave = async () => {
    if (!accessory) return

    if (calculatedMultiplier < 1.0 || calculatedMultiplier > 5.0) {
      toast.error('A szorzó 1.0 és 5.0 között kell legyen')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/accessories/${accessory.id}/multiplier`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          multiplier: calculatedMultiplier
        })
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Hiba történt a mentés során')
        return
      }

      const result = await response.json()
      
      // Update local state with new values
      setAccessory({
        ...accessory,
        multiplier: result.accessory.multiplier,
        net_price: result.accessory.net_price
      })

      toast.success('Szorzó sikeresen frissítve')
      
      // Clear and refocus for next scan
      setBarcodeInput('')
      setAccessory(null)
      setGrossPrice(0)
      setCalculatedMultiplier(0)
      
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
        }
      }, 300)
    } catch (error) {
      console.error('Error saving multiplier:', error)
      toast.error('Hiba történt a mentés során')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate current gross price for display
  const currentGrossPrice = accessory ? (() => {
    const vatPercent = accessory.vat?.kulcs || 0
    return Math.round(accessory.net_price + ((accessory.net_price * vatPercent) / 100))
  })() : 0

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 p-4">
      {/* Header with back button */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold active:bg-gray-300 active:scale-95 transition-all"
        >
          ← Vissza
        </button>
        <h1 className="text-xl font-bold text-gray-900">Ellenőrzés</h1>
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      {/* Hidden barcode input */}
      <input
        ref={barcodeInputRef}
        type="text"
        inputMode="none"
        value={barcodeInput}
        onChange={(e) => handleBarcodeInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current)
              scanTimeoutRef.current = null
            }
            const trimmedValue = barcodeInput.trim()
            if (trimmedValue.length > 0 && !isScanning) {
              handleBarcodeScan(trimmedValue)
            }
          }
        }}
        disabled={isScanning || !!accessory}
        className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
        autoFocus={false}
        autoComplete="off"
      />

      {/* Barcode input display (when no accessory loaded) */}
      {!accessory && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vonalkód beolvasása
            </label>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => handleBarcodeInputChange(e.target.value)}
              placeholder="Vonalkód..."
              disabled={isScanning}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            {isScanning && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Keresés...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accessory details (when loaded) */}
      {accessory && (
        <div className="flex-1 flex flex-col">
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kellék adatok</h2>
            
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Név
                </label>
                <p className="text-base text-gray-900">{accessory.name}</p>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <p className="text-base text-gray-900">{accessory.sku || '-'}</p>
              </div>

              {/* Net price (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nettó ár
                </label>
                <p className="text-base text-gray-900">
                  {accessory.net_price.toLocaleString('hu-HU')} {accessory.currencies?.name || 'Ft'}
                </p>
              </div>

              {/* Multiplier (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szorzó
                </label>
                <p className="text-base text-gray-900">{accessory.multiplier.toFixed(2)}</p>
              </div>

              {/* Gross price (editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bruttó ár (Ft) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={grossPrice || ''}
                  onChange={(e) => handleGrossPriceChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 text-lg border-2 border-blue-500 rounded-lg focus:border-blue-600 focus:outline-none font-semibold"
                  style={{ borderWidth: '3px' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Szerkeszthető - a szorzó automatikusan frissül
                </p>
              </div>

              {/* Calculated multiplier preview */}
              {grossPrice > 0 && calculatedMultiplier !== accessory.multiplier && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">
                    Új szorzó: {calculatedMultiplier.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Jelenlegi: {accessory.multiplier.toFixed(2)} → Új: {calculatedMultiplier.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setBarcodeInput('')
                setAccessory(null)
                setGrossPrice(0)
                setCalculatedMultiplier(0)
                setTimeout(() => {
                  if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus()
                  }
                }, 100)
              }}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold active:bg-gray-300 active:scale-95 transition-all disabled:opacity-50"
            >
              Új beolvasás
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || grossPrice === 0 || calculatedMultiplier === accessory.multiplier}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold active:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Mentés...' : 'Mentés'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
