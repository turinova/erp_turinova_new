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
  const [isEditingGrossPrice, setIsEditingGrossPrice] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const grossPriceInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus barcode input - always keep it focused when not scanning and not editing
  useEffect(() => {
    const focusInput = () => {
      if (isScanning || isEditingGrossPrice) return
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }

    // Initial focus
    const timer = setTimeout(focusInput, 100)
    
    // Re-focus on visibility change (when user returns to tab/app)
    const handleVisibilityChange = () => {
      if (!document.hidden && !isEditingGrossPrice) {
        setTimeout(focusInput, 100)
      }
    }
    
    // Re-focus on window focus
    const handleWindowFocus = () => {
      if (!isEditingGrossPrice) {
        setTimeout(focusInput, 100)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [isScanning, isEditingGrossPrice])

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
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Hidden barcode input - always focused for scanning */}
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
        onBlur={(e) => {
          // Don't refocus if user is editing gross price or if focus moved to another input
          const activeElement = document.activeElement
          const isAnotherInput = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA'
          ) && activeElement !== barcodeInputRef.current

          if (!isScanning && !isEditingGrossPrice && !isAnotherInput) {
            setTimeout(() => {
              // Double check before refocusing
              const currentActive = document.activeElement
              const stillAnotherInput = currentActive && (
                currentActive.tagName === 'INPUT' ||
                currentActive.tagName === 'TEXTAREA'
              ) && currentActive !== barcodeInputRef.current
              
              if (barcodeInputRef.current && !isScanning && !isEditingGrossPrice && !stillAnotherInput) {
                barcodeInputRef.current.focus()
              }
            }, 10)
          }
        }}
        disabled={isScanning}
        className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
        autoFocus={false}
        autoComplete="off"
      />

      {/* Fixed Top Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold active:bg-gray-300 active:scale-95 transition-all"
          >
            ← Vissza
          </button>
          <h1 className="text-lg font-bold text-gray-900">Ellenőrzés</h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {!accessory ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            {isScanning ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 text-lg">Keresés...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 text-lg">Vonalkód beolvasása...</p>
                <p className="text-gray-400 text-sm mt-2">Olvassa be a kellék vonalkódját</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            {/* Compact Accessory Details */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4 mb-3">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Kellék adatok</h2>
              
              <div className="space-y-2.5">
                {/* Name and SKU in one row */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 break-words">{accessory.name}</p>
                  {accessory.sku && (
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {accessory.sku}</p>
                  )}
                </div>

                {/* Net price and Multiplier in compact grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-600 mb-0.5">Nettó ár</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {accessory.net_price.toLocaleString('hu-HU')} {accessory.currencies?.name || 'Ft'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-0.5">Szorzó</p>
                    <p className="text-sm font-semibold text-gray-900">{accessory.multiplier.toFixed(2)}</p>
                  </div>
                </div>

                {/* Gross price (editable) */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Bruttó ár (Ft) <span className="text-red-600">*</span>
                  </label>
                  <input
                    ref={grossPriceInputRef}
                    type="number"
                    min="0"
                    step="1"
                    value={grossPrice || ''}
                    onChange={(e) => handleGrossPriceChange(parseFloat(e.target.value) || 0)}
                    onFocus={() => setIsEditingGrossPrice(true)}
                    onBlur={() => {
                      // Delay to allow other interactions
                      setTimeout(() => {
                        setIsEditingGrossPrice(false)
                        // Refocus barcode input after editing is done
                        if (barcodeInputRef.current && !isScanning) {
                          setTimeout(() => {
                            if (barcodeInputRef.current && document.activeElement !== grossPriceInputRef.current) {
                              barcodeInputRef.current.focus()
                            }
                          }, 100)
                        }
                      }, 200)
                    }}
                    className="w-full px-3 py-2.5 text-base border-3 border-blue-500 rounded-lg focus:border-blue-600 focus:outline-none font-semibold"
                    style={{ borderWidth: '3px' }}
                  />
                </div>

                {/* Calculated multiplier preview - compact */}
                {grossPrice > 0 && calculatedMultiplier !== accessory.multiplier && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-2.5 mt-2">
                    <p className="text-xs font-medium text-blue-900">
                      Új szorzó: {calculatedMultiplier.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {accessory.multiplier.toFixed(2)} → {calculatedMultiplier.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Section - Buttons */}
      {accessory && (
        <div className="bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
          <div className="p-4 flex gap-3">
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
