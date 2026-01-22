'use client'

import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'

interface OrderReceiptPrintProps {
  tenantCompany: {
    name?: string
    logo_url?: string | null
    postal_code?: string
    city?: string
    address?: string
    phone_number?: string
    email?: string
    tax_number?: string
  }
  orderNumber: string
  customerName: string
  barcode?: string | null
  pricing: Array<{
    id: string
    material_name?: string
    materials?: {
      name: string
    }
    charged_sqm?: number
    boards_used?: number
    waste_multi?: number
    quote_edge_materials_breakdown?: Array<{
      id: string
      edge_material_id: string
      edge_material_name: string
      total_length_m: number
      price_per_m: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
    quote_services_breakdown?: Array<{
      id: string
      service_type: string
      quantity: number
      unit_price: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
  }>
  logoBase64?: string | null
  copyType?: 'original' | 'customer'
}

export default function OrderReceiptPrint({
  tenantCompany,
  orderNumber,
  customerName,
  barcode,
  pricing,
  logoBase64,
  copyType = 'original'
}: OrderReceiptPrintProps) {
  // Debug logging
  console.log('[OrderReceiptPrint] Component rendered with barcode:', barcode || 'NO BARCODE')
  
  // Load Barcode component dynamically
  const [BarcodeComponent, setBarcodeComponent] = useState<any>(null)

  useEffect(() => {
    import('react-barcode').then((module) => {
      console.log('[OrderReceiptPrint] Barcode component loaded successfully')
      setBarcodeComponent(() => module.default)
    }).catch((error) => {
      console.error('[OrderReceiptPrint] Error loading barcode component:', error)
    })
  }, [])

  const formatQuantity = (pricingItem: typeof pricing[0]) => {
    const chargedSqm = pricingItem.charged_sqm || 0
    const boardsSold = pricingItem.boards_used || 0
    const wasteMulti = pricingItem.waste_multi || 1
    
    // Divide charged_sqm by waste_multi to show net material quantity
    const displaySqm = chargedSqm / wasteMulti
    
    return `${displaySqm.toFixed(2)} m2 / ${boardsSold} db`
  }

  const getMaterialName = (pricingItem: typeof pricing[0]) => {
    return pricingItem.materials?.name || pricingItem.material_name || ''
  }

  // Collect and aggregate services from all pricing items
  const getAggregatedServices = () => {
    const servicesMap = new Map<string, { name: string; quantity: number; unit: string }>()

    pricing.forEach((pricingItem) => {
      if (pricingItem.quote_services_breakdown) {
        pricingItem.quote_services_breakdown.forEach((service) => {
          // Translate service type to Hungarian name
          let serviceName = ''
          let unit = ''
          
          switch (service.service_type) {
            case 'panthelyfuras':
              serviceName = 'Pánthelyfúrás'
              unit = 'db'
              break
            case 'duplungolas':
              serviceName = 'Duplungolás'
              unit = 'm2'
              break
            case 'szogvagas':
              serviceName = 'Szögvágás'
              unit = 'db'
              break
            default:
              serviceName = service.service_type
              unit = 'db'
          }

          const existing = servicesMap.get(service.service_type)
          if (existing) {
            existing.quantity += service.quantity
          } else {
            servicesMap.set(service.service_type, {
              name: serviceName,
              quantity: service.quantity,
              unit: unit
            })
          }
        })
      }
    })

    return Array.from(servicesMap.values())
  }

  const aggregatedServices = getAggregatedServices()

  const now = new Date()
  const printDate = now.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const printTime = now.toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <Box
      id="order-receipt-print-container"
      sx={{
        width: '80mm',
        maxWidth: '80mm',
        padding: '4mm',
        fontFamily: 'monospace',
        fontSize: '9px',
        lineHeight: '1.2',
        color: '#000',
        backgroundColor: '#fff'
      }}
    >
      {/* Receipt Title - Same size as company name, with double separator lines */}
      <Box
        sx={{
          textAlign: 'center'
        }}
      >
        {/* Top double separator line */}
        <Box
          sx={{
            borderTop: '2px solid #000'
          }}
        />
        
        <Typography
          variant="h4"
          sx={{
            fontSize: '18px',
            fontWeight: 'bold',
            lineHeight: '1.2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          Átvételi elismervény
        </Typography>
        
        {/* "Vevői példány" subheader for customer copy */}
        {copyType === 'customer' && (
          <Typography
            variant="h4"
            sx={{
              fontSize: '18px',
              fontWeight: 'bold',
              lineHeight: '1.2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '2mm'
            }}
          >
            Vevői példány
          </Typography>
        )}
        
        {/* Bottom double separator line */}
        <Box
          sx={{
            borderTop: '2px solid #000'
          }}
        />
      </Box>

      {/* Company Name - Large, Centered, No Wrap */}
      {tenantCompany.name && (
        <Box
          sx={{
            textAlign: 'center',
            marginBottom: '4mm',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontSize: '18px',
              fontWeight: 'bold',
              lineHeight: '1.2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {tenantCompany.name}
          </Typography>
        </Box>
      )}

      {/* Logo */}
      {logoBase64 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '4mm',
            height: '10mm' // 1 cm height
          }}
        >
          <img
            src={logoBase64}
            alt="Logo"
            style={{
              maxHeight: '10mm',
              maxWidth: '100%',
              objectFit: 'contain'
            }}
          />
        </Box>
      )}

      {/* Company Info */}
      <Box sx={{ textAlign: 'center', marginBottom: '3mm' }}>
        {tenantCompany.postal_code && tenantCompany.city && (
          <Typography
            variant="body2"
            sx={{
              fontSize: '9px',
              marginBottom: '1px',
              fontWeight: 'normal'
            }}
          >
            {tenantCompany.postal_code} {tenantCompany.city}
          </Typography>
        )}
        {tenantCompany.address && (
          <Typography
            variant="body2"
            sx={{
              fontSize: '9px',
              marginBottom: '1px',
              fontWeight: 'normal'
            }}
          >
            {tenantCompany.address}
          </Typography>
        )}
        {tenantCompany.phone_number && (
          <Typography
            variant="body2"
            sx={{
              fontSize: '9px',
              marginBottom: '1px',
              fontWeight: 'normal'
            }}
          >
            {tenantCompany.phone_number}
          </Typography>
        )}
        {tenantCompany.email && (
          <Typography
            variant="body2"
            sx={{
              fontSize: '9px',
              marginBottom: '1px',
              fontWeight: 'normal'
            }}
          >
            {tenantCompany.email}
          </Typography>
        )}
        {tenantCompany.tax_number && (
          <Typography
            variant="body2"
            sx={{
              fontSize: '9px',
              marginBottom: '1px',
              fontWeight: 'normal'
            }}
          >
            Adószám: {tenantCompany.tax_number}
          </Typography>
        )}
      </Box>

      {/* Separator */}
      <Box
        sx={{
          borderTop: '1px dashed #000',
          margin: '3mm 0',
          width: '100%'
        }}
      />

      {/* Order Number and Customer Name */}
      <Box sx={{ marginBottom: '3mm' }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: '9px',
            marginBottom: '2px',
            fontWeight: 'bold'
          }}
        >
          Megrendelés száma: {orderNumber}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontSize: '9px',
            marginBottom: '2px',
            fontWeight: 'bold'
          }}
        >
          Ügyfél neve: {customerName}
        </Typography>
      </Box>

      {/* Separator */}
      <Box
        sx={{
          borderTop: '1px dashed #000',
          margin: '3mm 0',
          width: '100%'
        }}
      />

      {/* Materials Table */}
      <Box sx={{ marginBottom: '3mm' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8px'
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '2px 0',
                  borderBottom: '1px solid #000',
                  fontWeight: 'bold',
                  fontSize: '8px',
                  width: '60%'
                }}
              >
                Anyag
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '2px 0',
                  borderBottom: '1px solid #000',
                  fontWeight: 'bold',
                  fontSize: '8px',
                  width: '40%',
                  whiteSpace: 'nowrap'
                }}
              >
                Mennyiség
              </th>
            </tr>
          </thead>
          <tbody>
            {pricing && pricing.length > 0 ? (
              pricing.map((item) => {
                // Calculate total edge length if edge materials exist
                const edgeBreakdown = item.quote_edge_materials_breakdown
                const hasEdgeBreakdown = Array.isArray(edgeBreakdown) && edgeBreakdown.length > 0
                
                const totalEdgeLength = hasEdgeBreakdown
                  ? edgeBreakdown.reduce(
                      (sum: number, edge: any) => sum + (edge?.total_length_m || 0),
                      0
                    )
                  : 0
                
                return (
                  <React.Fragment key={item.id}>
                    <tr>
                      <td
                        style={{
                          textAlign: 'left',
                          padding: '2px 0',
                          fontSize: '8px',
                          wordBreak: 'break-word',
                          width: '60%'
                        }}
                      >
                        {getMaterialName(item)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '2px 0',
                          fontSize: '8px',
                          width: '40%',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatQuantity(item)}
                      </td>
                    </tr>
                    {/* Edge material info row - only show if edge materials exist */}
                    {totalEdgeLength > 0 && (
                      <tr>
                        <td
                          style={{
                            textAlign: 'left',
                            padding: '2px 0',
                            fontSize: '8px',
                            width: '60%'
                          }}
                        >
                          {/* Empty for indentation effect */}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '2px 0',
                            fontSize: '8px',
                            width: '40%',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Élzáró: {totalEdgeLength.toFixed(2)} m
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    textAlign: 'center',
                    padding: '4px 0',
                    fontSize: '8px',
                    color: '#666'
                  }}
                >
                  Nincs anyag adat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>

      {/* Services Table - Only show if there are services */}
      {aggregatedServices.length > 0 && (
        <>
          {/* Separator */}
          <Box
            sx={{
              borderTop: '1px dashed #000',
              margin: '3mm 0',
              width: '100%'
            }}
          />

          {/* Services Table */}
          <Box sx={{ marginBottom: '3mm' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8px'
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '2px 0',
                      borderBottom: '1px solid #000',
                      fontWeight: 'bold',
                      fontSize: '8px'
                    }}
                  >
                    Megnevezés
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '2px 0',
                      borderBottom: '1px solid #000',
                      fontWeight: 'bold',
                      fontSize: '8px'
                    }}
                  >
                    Mennyiség
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregatedServices.map((service, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        textAlign: 'left',
                        padding: '2px 0',
                        fontSize: '8px',
                        wordBreak: 'break-word'
                      }}
                    >
                      {service.name}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '2px 0',
                        fontSize: '8px'
                      }}
                    >
                      {service.quantity % 1 === 0 
                        ? `${service.quantity} ${service.unit}`
                        : `${service.quantity.toFixed(2)} ${service.unit}`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </>
      )}

      {/* Separator */}
      <Box
        sx={{
          borderTop: '1px dashed #000',
          margin: '3mm 0',
          width: '100%'
        }}
      />

      {/* Legal Disclaimer - Centered, with line breaks */}
      <Box sx={{ marginBottom: '3mm', textAlign: 'center' }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: '7px',
            lineHeight: '1.3',
            textAlign: 'center'
          }}
        >
          A megrendelő igazolja, hogy az árut
          <br />
          mennyiségben és minőségben
          <br />
          hiánytalanul átvette.
          <br />
          Az átvételt követően
          <br />
          reklamációra nincs lehetőség.
        </Typography>
      </Box>

      {/* Additional line (only for original copy) */}
      {copyType === 'original' && (
        <Box sx={{ marginBottom: '3mm' }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: '7px',
              lineHeight: '1.3',
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            Áru kizárólag ezen átvételi blokk bemutatásával adható ki.
          </Typography>
        </Box>
      )}

      {/* Print Date and Time */}
      <Box sx={{ marginBottom: '4mm', textAlign: 'center' }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: '8px',
            marginBottom: '1px'
          }}
        >
          Nyomtatva: {printDate} {printTime}
        </Typography>
      </Box>

      {/* Signature Lines (only for original copy) */}
      {copyType === 'original' && (
        <Box
          sx={{
            marginTop: '6mm',
            display: 'flex',
            flexDirection: 'column',
            gap: '8mm'
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontSize: '8px',
                marginBottom: '4mm',
                borderBottom: '1px solid #000',
                paddingBottom: '1px',
                minHeight: '8mm'
              }}
            >
              Ügyfél aláírása:
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontSize: '8px',
                marginBottom: '4mm',
                borderBottom: '1px solid #000',
                paddingBottom: '1px',
                minHeight: '8mm'
              }}
            >
              Átadó munkatárs neve:
            </Typography>
          </Box>
        </Box>
      )}

      {/* Barcode - 1 line feed spacing from signature line */}
      {barcode && barcode.trim() && BarcodeComponent && (
        <Box
          sx={{
            marginTop: '2.5mm',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          <BarcodeComponent
            value={barcode.trim()}
            format="CODE128"
            width={2}
            height={100}
            displayValue={true}
            fontSize={10}
            margin={0}
          />
        </Box>
      )}
      {/* Fallback if barcode component not loaded yet */}
      {barcode && barcode.trim() && !BarcodeComponent && (
        <Box
          sx={{
            marginTop: '2.5mm',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '8px',
              fontFamily: 'monospace',
              letterSpacing: 2
            }}
          >
            {barcode.trim()}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

