import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

// Számlázz.hu API credentials
const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

// Configure XML parser to handle namespaces and preserve structure
// Try with namespace preservation first
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
  ignoreNameSpace: false,
  removeNSPrefix: false,
  parseNodeValue: true,
  parseTagValue: true,
  stopNodes: [],
  processEntities: true,
  htmlEntities: false
})

// Also create a parser that ignores namespaces as a fallback
const xmlParserNoNS = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
  ignoreNameSpace: true, // This one ignores namespaces
  removeNSPrefix: true,
  parseNodeValue: true,
  parseTagValue: true,
  stopNodes: [],
  processEntities: true,
  htmlEntities: false
})

// Helper function to escape XML
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Build XML request for querying taxpayer
// According to https://docs.szamlazz.hu/agent/querying_taxpayer/request
// The XML structure needs beallitasok wrapper and uses torzsszam instead of adoszam
function buildQueryTaxpayerXml(taxNumber: string): string {
  // Extract the 8-digit tax number part (before the hyphen)
  // Format: 12345678-1-23 -> 12345678
  const cleanTaxNumber = taxNumber.replace(/\s+/g, '').split('-')[0]
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer https://www.szamlazz.hu/szamla/docs/xsds/agenttaxpayer/xmltaxpayer.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
  </beallitasok>
  <torzsszam>${escapeXml(cleanTaxNumber)}</torzsszam>
</xmltaxpayer>`

  return xml
}

interface TaxpayerQueryRequest {
  taxNumber: string
}

export async function POST(request: NextRequest) {
  try {
    const body: TaxpayerQueryRequest = await request.json()
    const { taxNumber } = body

    if (!taxNumber || !taxNumber.trim()) {
      return NextResponse.json(
        { error: 'Adószám megadása kötelező' },
        { status: 400 }
      )
    }

    // Clean tax number (remove spaces, ensure format)
    const cleanTaxNumber = taxNumber.trim().replace(/\s+/g, '')

    // Build XML request
    const xmlRequest = buildQueryTaxpayerXml(cleanTaxNumber)

    // Send request to szamlazz.hu as multipart/form-data
    // According to documentation: https://docs.szamlazz.hu/agent/querying_taxpayer/request
    // Must be multipart/form-data with file field named "action-szamla_agent_taxpayer"
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_taxpayer', xmlBlob, 'taxpayer.xml')

    const response = await fetch(SZAMLAZZ_API_URL, {
      method: 'POST',
      body: formData
    })

    // Check for errors in headers
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')

    // Read response as text
    const responseText = await response.text()

    // Log for debugging - log full response to see structure
    console.log('Taxpayer query response:', {
      status: response.status,
      errorCode,
      errorMessage,
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 3000) // Log first 3000 chars to see structure
    })
    
    // Also log if we can see taxpayerName in the response
    if (responseText.includes('taxpayerName')) {
      console.log('Response contains taxpayerName tag')
    } else {
      console.log('Response does NOT contain taxpayerName tag')
    }

    if (errorCode || errorMessage) {
      console.error('Szamlazz.hu API error:', {
        code: errorCode,
        message: errorMessage,
        response: responseText.substring(0, 500)
      })
      return NextResponse.json(
        {
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
          details: responseText.substring(0, 500)
        },
        { status: 400 }
      )
    }

    // Parse XML response
    // According to https://docs.szamlazz.hu/agent/querying_taxpayer/response
    // The response contains QueryTaxpayerResponse with taxpayer data
    if (!responseText || responseText.length === 0) {
      return NextResponse.json(
        { error: 'Üres válasz érkezett a szamlazz.hu-tól' },
        { status: 500 }
      )
    }

    // Parse XML response according to NAV XML structure
    // Documentation: https://docs.szamlazz.hu/hu/agent/querying_taxpayer/response
    // Structure: QueryTaxpayerResponse > taxpayerData > taxpayerName, taxpayerAddressList > taxpayerAddressItem > taxpayerAddress
    
    // Log full response for debugging (first 2000 chars)
    console.log('Full taxpayer query response XML:', responseText.substring(0, 2000))
    
    // Also log the address section specifically to see the structure
    const addressSectionMatch = responseText.match(/<taxpayerAddress[^>]*>([\s\S]*?)<\/taxpayerAddress>/i)
    if (addressSectionMatch) {
      console.log('Address section from raw XML:', addressSectionMatch[0].substring(0, 1000))
    }
    
    let parsedXml: any = null
    let parsedXmlNoNS: any = null
    try {
      // Parse XML using fast-xml-parser (with namespace preservation)
      parsedXml = xmlParser.parse(responseText)
      console.log('XML parsed successfully (with namespaces)')
      
      // Also parse without namespace handling as backup
      try {
        parsedXmlNoNS = xmlParserNoNS.parse(responseText)
        console.log('XML parsed successfully (without namespaces)')
      } catch (e) {
        console.log('Failed to parse XML without namespaces, using namespace-preserved version only')
      }
      
      // Log parsed structure for debugging (first level keys)
      if (parsedXml) {
        console.log('Parsed XML top-level keys:', Object.keys(parsedXml))
        // Log a sample of the parsed structure
        const sampleJson = JSON.stringify(parsedXml, null, 2).substring(0, 3000)
        console.log('Parsed XML structure sample:', sampleJson)
      }
    } catch (parseError: any) {
      console.error('Error parsing XML:', parseError)
      // Fallback to regex-based extraction if XML parsing fails
      console.log('Falling back to regex-based extraction')
    }
    
    // Helper function to safely get nested property with namespace variations
    const getValue = (obj: any, paths: string[]): string => {
      if (!obj) return ''
      for (const path of paths) {
        const keys = path.split('.')
        let current: any = obj
        for (const key of keys) {
          if (current && typeof current === 'object') {
            // Try exact key
            if (key in current) {
              current = current[key]
              continue
            }
            // Try with ns2: prefix
            if (`ns2:${key}` in current) {
              current = current[`ns2:${key}`]
              continue
            }
            // Try case-insensitive search
            const foundKey = Object.keys(current).find(k => k.toLowerCase() === key.toLowerCase() || k.toLowerCase() === `ns2:${key.toLowerCase()}`)
            if (foundKey) {
              current = current[foundKey]
              continue
            }
            return ''
          }
          return ''
        }
        if (current && typeof current === 'string') {
          return current.trim()
        }
        if (current && typeof current === 'object' && '#text' in current) {
          return String(current['#text'] || '').trim()
        }
      }
      return ''
    }
    
    // Extract funcCode and error message from XML
    let funcCode = ''
    let xmlErrorMessage = ''
    let taxpayerValidity = ''
    
    if (parsedXml) {
      funcCode = getValue(parsedXml, [
        'QueryTaxpayerResponse.result.funcCode',
        'result.funcCode',
        'funcCode'
      ])
      xmlErrorMessage = getValue(parsedXml, [
        'QueryTaxpayerResponse.result.message',
        'result.message',
        'message'
      ])
      taxpayerValidity = getValue(parsedXml, [
        'QueryTaxpayerResponse.taxpayerValidity',
        'taxpayerValidity'
      ]).toLowerCase()
    } else {
      // Fallback regex extraction for basic fields
      const funcCodeMatch = responseText.match(/<funcCode[^>]*>(.*?)<\/funcCode>/is)
      funcCode = funcCodeMatch ? funcCodeMatch[1].trim() : ''
      const errorMessageMatch = responseText.match(/<message[^>]*>(.*?)<\/message>/is)
      xmlErrorMessage = errorMessageMatch ? errorMessageMatch[1].trim() : ''
      const taxpayerValidityMatch = responseText.match(/<taxpayerValidity[^>]*>(.*?)<\/taxpayerValidity>/is)
      taxpayerValidity = taxpayerValidityMatch ? taxpayerValidityMatch[1].trim().toLowerCase() : ''
    }
    
    console.log('Taxpayer validation check:', { funcCode, taxpayerValidity, xmlErrorMessage })
    
    // If funcCode is ERROR, return error immediately
    if (funcCode === 'ERROR') {
      const errorMsg = xmlErrorMessage || 'Az adószám nem található a NAV rendszerében vagy érvénytelen'
      console.log('Taxpayer query failed with ERROR funcCode:', errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 404 }
      )
    }
    
    // Extract taxpayer name
    let taxpayerName = ''
    if (parsedXml) {
      taxpayerName = getValue(parsedXml, [
        'QueryTaxpayerResponse.taxpayerData.taxpayerName',
        'taxpayerData.taxpayerName',
        'taxpayerName'
      ])
    } else {
      // Fallback regex extraction
      const taxpayerNameMatch = responseText.match(/<taxpayerName[^>]*>(.*?)<\/taxpayerName>/is)
      if (taxpayerNameMatch) {
        taxpayerName = taxpayerNameMatch[1].trim()
      }
    }
    
    console.log('Extracted taxpayer name:', taxpayerName || '(empty)')
    
    // Extract address fields
    let postalCode = ''
    let city = ''
    let streetName = ''
    let houseNumber = ''
    let publicPlaceCategory = ''
    
    if (parsedXml) {
      // Helper to extract value from object with namespace variations
      // Based on the XML structure, fields are under ns2: namespace
      const extractField = (obj: any, fieldNames: string[]): string => {
        if (!obj || typeof obj !== 'object') return ''
        for (const fieldName of fieldNames) {
          // First try with ns2: prefix (as per actual XML structure)
          const ns2Field = fieldName.startsWith('ns2:') ? fieldName : `ns2:${fieldName}`
          if (ns2Field in obj) {
            const val = obj[ns2Field]
            if (typeof val === 'string' && val.trim()) return val.trim()
            if (val && typeof val === 'object') {
              if ('#text' in val) {
                const text = String(val['#text'] || '').trim()
                if (text) return text
              }
              // Sometimes the value might be directly the object
              if (Object.keys(val).length === 1 && '#text' in val) {
                return String(val['#text'] || '').trim()
              }
            }
          }
          // Try exact match without namespace
          if (fieldName in obj) {
            const val = obj[fieldName]
            if (typeof val === 'string' && val.trim()) return val.trim()
            if (val && typeof val === 'object') {
              if ('#text' in val) {
                const text = String(val['#text'] || '').trim()
                if (text) return text
              }
            }
          }
          // Try case-insensitive search
          const foundKey = Object.keys(obj).find(k => {
            const kLower = k.toLowerCase()
            const fieldLower = fieldName.toLowerCase()
            const ns2Lower = ns2Field.toLowerCase()
            return kLower === fieldLower || kLower === ns2Lower || 
                   kLower.includes(fieldLower) || kLower.includes(ns2Lower.replace('ns2:', ''))
          })
          if (foundKey) {
            const val = obj[foundKey]
            if (typeof val === 'string' && val.trim()) return val.trim()
            if (val && typeof val === 'object' && '#text' in val) {
              const text = String(val['#text'] || '').trim()
              if (text) return text
            }
          }
        }
        return ''
      }
      
      // Get address list from parsed XML (try multiple paths)
      // Structure: QueryTaxpayerResponse > taxpayerData > taxpayerAddressList > taxpayerAddressItem > taxpayerAddress > ns2:fields
      const getAddressList = (): any => {
        return parsedXml.QueryTaxpayerResponse?.taxpayerData?.taxpayerAddressList ||
               parsedXml.taxpayerData?.taxpayerAddressList ||
               parsedXml.taxpayerAddressList ||
               null
      }
      
      const addressList = getAddressList()
      console.log('Address list found:', !!addressList, addressList ? Object.keys(addressList) : [])
      
      // Get address items (could be array or single object)
      let addressItems: any[] = []
      if (addressList) {
        const items = addressList.taxpayerAddressItem || 
                     addressList['ns2:taxpayerAddressItem'] ||
                     (() => {
                       // Try to find any key that looks like an address item
                       for (const key in addressList) {
                         if (key.toLowerCase().includes('addressitem')) {
                           return addressList[key]
                         }
                       }
                       return null
                     })()
        
        if (Array.isArray(items)) {
          addressItems = items
          console.log(`Found ${items.length} address items (array)`)
        } else if (items) {
          addressItems = [items]
          console.log('Found 1 address item (single object)')
        } else {
          console.log('No address items found in address list')
        }
      } else {
        console.log('No address list found in parsed XML')
      }
      
      // Prefer HQ (headquarters) address, otherwise use first available
      let selectedAddress: any = null
      for (const item of addressItems) {
        const addressType = extractField(item, ['taxpayerAddressType', '@_taxpayerAddressType'])
        console.log('Checking address item with type:', addressType)
        if (addressType === 'HQ' || addressType === 'HEADQUARTERS') {
          selectedAddress = item.taxpayerAddress || item['ns2:taxpayerAddress'] || item
          console.log('Selected HQ address:', selectedAddress ? Object.keys(selectedAddress) : 'null')
          break
        }
      }
      if (!selectedAddress && addressItems.length > 0) {
        selectedAddress = addressItems[0].taxpayerAddress || 
                         addressItems[0]['ns2:taxpayerAddress'] || 
                         addressItems[0]
        console.log('Selected first available address:', selectedAddress ? Object.keys(selectedAddress) : 'null')
      }
      
      if (selectedAddress) {
        console.log('Extracting fields from selected address, available keys:', Object.keys(selectedAddress))
        console.log('Full selected address object:', JSON.stringify(selectedAddress, null, 2).substring(0, 2000))
        
        // Direct extraction - try multiple approaches
        // Approach 1: Direct key access with ns2: prefix (most likely based on XML structure)
        if (selectedAddress['ns2:postalCode']) {
          postalCode = typeof selectedAddress['ns2:postalCode'] === 'string' 
            ? selectedAddress['ns2:postalCode'].trim() 
            : String(selectedAddress['ns2:postalCode']?.['#text'] || '').trim()
        }
        if (selectedAddress['ns2:city']) {
          city = typeof selectedAddress['ns2:city'] === 'string' 
            ? selectedAddress['ns2:city'].trim() 
            : String(selectedAddress['ns2:city']?.['#text'] || '').trim()
        }
        if (selectedAddress['ns2:streetName']) {
          streetName = typeof selectedAddress['ns2:streetName'] === 'string' 
            ? selectedAddress['ns2:streetName'].trim() 
            : String(selectedAddress['ns2:streetName']?.['#text'] || '').trim()
        }
        
        // Extract house number - check all possible number fields
        // In Hungarian addresses, there can be building number and house number
        // We want the house number (házszám), which is typically a simple number like "10"
        // Building number (épület szám) might be like "1/a"
        
        // First, log all number-related fields to see what we have
        const allNumberFields: string[] = []
        for (const key in selectedAddress) {
          if (key.toLowerCase().includes('number') || key.toLowerCase() === 'number' || key === 'ns2:number') {
            const value = selectedAddress[key]
            const strValue = typeof value === 'string' ? value : String(value?.['#text'] || '')
            allNumberFields.push(`${key}: ${strValue}`)
          }
        }
        console.log('All number fields found in address:', allNumberFields)
        
        // Try to get the house number - prefer simple numeric values
        // Check if ns2:number exists - it might be a single value or an array
        const numberField = selectedAddress['ns2:number']
        
        if (numberField) {
          let numberValues: string[] = []
          
          // Handle array case (multiple number fields)
          if (Array.isArray(numberField)) {
            numberValues = numberField.map(n => 
              typeof n === 'string' ? n.trim() : String(n?.['#text'] || '').trim()
            ).filter(n => n)
            console.log(`Found ns2:number as array with ${numberValues.length} values:`, numberValues)
          } else {
            // Single value
            const numValue = typeof numberField === 'string' 
              ? numberField.trim() 
              : String(numberField?.['#text'] || '').trim()
            if (numValue) {
              numberValues = [numValue]
            }
            console.log(`Found ns2:number as single value: "${numValue}"`)
          }
          
          // If we have multiple values, prefer the one that looks most like a house number
          // House numbers are typically simple numbers (like "10"), not building numbers (like "1/a")
          if (numberValues.length > 1) {
            // Prefer values that are:
            // 1. Pure numbers (no letters, slashes)
            // 2. Shorter (house numbers are usually shorter)
            // 3. Don't contain "/" (building numbers often have "/")
            const pureNumbers = numberValues.filter(n => /^\d+\.?$/.test(n))
            const withoutSlash = numberValues.filter(n => !n.includes('/'))
            
            if (pureNumbers.length > 0) {
              // Prefer pure numeric values
              houseNumber = pureNumbers[0]
              console.log(`Selected pure numeric value as house number: "${houseNumber}"`)
            } else if (withoutSlash.length > 0) {
              // Prefer values without slashes
              houseNumber = withoutSlash[0]
              console.log(`Selected value without slash as house number: "${houseNumber}"`)
            } else {
              // Fallback to first value
              houseNumber = numberValues[0]
              console.log(`Using first value as house number: "${houseNumber}"`)
            }
          } else if (numberValues.length === 1) {
            // Single value - use it if it looks valid
            const numValue = numberValues[0]
            if (numValue && numValue.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(numValue)) {
              houseNumber = numValue
              console.log(`Using single ns2:number value as house number: "${houseNumber}"`)
            }
          }
        }
        
        // Also check for other possible house number fields
        // Some XML structures might have separate fields for building vs house number
        const possibleHouseNumberFields = [
          'ns2:houseNumber',
          'houseNumber',
          'ns2:buildingNumber',
          'buildingNumber',
          'ns2:addressNumber',
          'addressNumber'
        ]
        
        for (const fieldName of possibleHouseNumberFields) {
          if (selectedAddress[fieldName] && !houseNumber) {
            const value = typeof selectedAddress[fieldName] === 'string' 
              ? selectedAddress[fieldName].trim() 
              : String(selectedAddress[fieldName]?.['#text'] || '').trim()
            if (value) {
              houseNumber = value
              console.log(`Found house number in field ${fieldName}: "${houseNumber}"`)
              break
            }
          }
        }
        if (selectedAddress['ns2:publicPlaceCategory']) {
          publicPlaceCategory = typeof selectedAddress['ns2:publicPlaceCategory'] === 'string' 
            ? selectedAddress['ns2:publicPlaceCategory'].trim() 
            : String(selectedAddress['ns2:publicPlaceCategory']?.['#text'] || '').trim()
        }
        
        // Approach 2: Use extractField helper for fallback
        if (!postalCode) postalCode = extractField(selectedAddress, ['ns2:postalCode', 'postalCode'])
        if (!city) city = extractField(selectedAddress, ['ns2:city', 'city'])
        if (!streetName) streetName = extractField(selectedAddress, ['ns2:streetName', 'streetName'])
        // For house number, only extract if we haven't found it yet and validate it
        if (!houseNumber) {
          const extractedNumber = extractField(selectedAddress, ['ns2:number'])
          // Validate it looks like a house number (not a tax number or other ID)
          if (extractedNumber && extractedNumber.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(extractedNumber)) {
            houseNumber = extractedNumber
          }
        }
        if (!publicPlaceCategory) publicPlaceCategory = extractField(selectedAddress, ['ns2:publicPlaceCategory', 'publicPlaceCategory'])
        
        console.log('Extracted from structured address:', {
          postalCode: postalCode || '(empty)',
          city: city || '(empty)',
          streetName: streetName || '(empty)',
          houseNumber: houseNumber || '(empty)',
          publicPlaceCategory: publicPlaceCategory || '(empty)'
        })
      } else {
        console.log('No selected address found')
      }
      
      // Always search recursively in the entire parsed XML to ensure we find all fields
      // This is a fallback in case structured extraction didn't find everything
      const searchInObject = (obj: any, depth = 0, path = ''): void => {
        if (depth > 20 || !obj || typeof obj !== 'object') return
        
        for (const key in obj) {
          const lowerKey = key.toLowerCase()
          const value = obj[key]
          const currentPath = path ? `${path}.${key}` : key
          
          // Extract postal code - try multiple patterns
          if (!postalCode) {
            if (lowerKey === 'postalcode' || lowerKey === 'ns2:postalcode' || 
                lowerKey.includes('postal') && lowerKey.includes('code')) {
              if (typeof value === 'string' && value.trim()) {
                postalCode = value.trim()
                console.log(`Found postalCode at path: ${currentPath}, value: ${postalCode}`)
              } else if (value && typeof value === 'object' && '#text' in value) {
                const text = String(value['#text'] || '').trim()
                if (text) {
                  postalCode = text
                  console.log(`Found postalCode at path: ${currentPath}, value: ${postalCode}`)
                }
              }
            }
          }
          
          // Extract city
          if (!city) {
            if (lowerKey === 'city' || lowerKey === 'ns2:city' || 
                (lowerKey.includes('city') && !lowerKey.includes('country'))) {
              if (typeof value === 'string' && value.trim()) {
                city = value.trim()
                console.log(`Found city at path: ${currentPath}, value: ${city}`)
              } else if (value && typeof value === 'object' && '#text' in value) {
                const text = String(value['#text'] || '').trim()
                if (text) {
                  city = text
                  console.log(`Found city at path: ${currentPath}, value: ${city}`)
                }
              }
            }
          }
          
          // Extract street name
          if (!streetName) {
            if (lowerKey === 'streetname' || lowerKey === 'ns2:streetname' || 
                (lowerKey.includes('street') && lowerKey.includes('name'))) {
              if (typeof value === 'string' && value.trim()) {
                streetName = value.trim()
                console.log(`Found streetName at path: ${currentPath}, value: ${streetName}`)
              } else if (value && typeof value === 'object' && '#text' in value) {
                const text = String(value['#text'] || '').trim()
                if (text) {
                  streetName = text
                  console.log(`Found streetName at path: ${currentPath}, value: ${streetName}`)
                }
              }
            }
          }
          
            // Extract house number - be very careful, only extract from address context
            // Check if we're in an address-related path to avoid matching other number fields
            if (!houseNumber) {
              const isInAddressContext = currentPath.toLowerCase().includes('address') || 
                                        currentPath.toLowerCase().includes('taxpayeraddress')
              
              if ((lowerKey === 'number' || lowerKey === 'ns2:number') && isInAddressContext) {
                // Only extract if it looks like a house number (short, alphanumeric)
                if (typeof value === 'string' && value.trim()) {
                  const trimmed = value.trim()
                  // House numbers are typically short (1-20 chars) and alphanumeric, may contain dots, slashes, hyphens
                  // Exclude very long numbers (likely tax numbers or IDs)
                  if (trimmed.length > 0 && trimmed.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(trimmed)) {
                    // Additional check: if it's all digits and longer than 8, it's probably not a house number
                    if (!(/^\d+$/.test(trimmed) && trimmed.length > 8)) {
                      houseNumber = trimmed
                      console.log(`Found houseNumber at path: ${currentPath}, value: ${houseNumber}`)
                    }
                  }
                } else if (value && typeof value === 'object' && '#text' in value) {
                  const text = String(value['#text'] || '').trim()
                  if (text && text.length > 0 && text.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(text)) {
                    // Additional check: if it's all digits and longer than 8, it's probably not a house number
                    if (!(/^\d+$/.test(text) && text.length > 8)) {
                      houseNumber = text
                      console.log(`Found houseNumber at path: ${currentPath}, value: ${houseNumber}`)
                    }
                  }
                }
              }
            }
          
          // Extract public place category
          if (!publicPlaceCategory) {
            if (lowerKey === 'publicplacecategory' || lowerKey === 'ns2:publicplacecategory' ||
                (lowerKey.includes('public') && lowerKey.includes('place') && lowerKey.includes('category'))) {
              if (typeof value === 'string' && value.trim()) {
                publicPlaceCategory = value.trim()
                console.log(`Found publicPlaceCategory at path: ${currentPath}, value: ${publicPlaceCategory}`)
              } else if (value && typeof value === 'object' && '#text' in value) {
                const text = String(value['#text'] || '').trim()
                if (text) {
                  publicPlaceCategory = text
                  console.log(`Found publicPlaceCategory at path: ${currentPath}, value: ${publicPlaceCategory}`)
                }
              }
            }
          }
          
          // Recursively search nested objects
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            searchInObject(value, depth + 1, currentPath)
          } else if (Array.isArray(value)) {
            // Also search in array elements
            value.forEach((item: any, index: number) => {
              if (typeof item === 'object' && item !== null) {
                searchInObject(item, depth + 1, `${currentPath}[${index}]`)
              }
            })
          }
        }
      }
      
      // Always do a full recursive search to catch any fields we might have missed
      searchInObject(parsedXml)
      
      // Also search in the namespace-ignored version if available
      if (parsedXmlNoNS && (!postalCode || !city || !houseNumber)) {
        console.log('Searching in namespace-ignored parsed XML...')
        searchInObject(parsedXmlNoNS)
      }
    }
    
    // Also try regex extraction as a backup even if XML parsing succeeded
    // This helps catch fields that might be in a different format
    if (!postalCode || !city || !houseNumber) {
      console.log('Trying regex fallback for missing fields...')
      
      // Try multiple regex patterns for each field
      if (!postalCode) {
        const postalCodePatterns = [
          /<ns2:postalCode[^>]*>([^<]*)<\/ns2:postalCode>/i,
          /<postalCode[^>]*>([^<]*)<\/postalCode>/i,
          /<[^:]*:postalCode[^>]*>([^<]*)<\/[^:]*:postalCode>/i,
          /postalCode[^>]*>([^<]+)</i
        ]
        for (const pattern of postalCodePatterns) {
          const match = responseText.match(pattern)
          if (match && match[1] && match[1].trim()) {
            postalCode = match[1].trim()
            console.log('Found postalCode via regex:', postalCode)
            break
          }
        }
      }
      
      if (!city) {
        const cityPatterns = [
          /<ns2:city[^>]*>([^<]*)<\/ns2:city>/i,
          /<city[^>]*>([^<]*)<\/city>/i,
          /<[^:]*:city[^>]*>([^<]*)<\/[^:]*:city>/i,
          /city[^>]*>([^<]+)</i
        ]
        for (const pattern of cityPatterns) {
          const match = responseText.match(pattern)
          if (match && match[1] && match[1].trim()) {
            city = match[1].trim()
            console.log('Found city via regex:', city)
            break
          }
        }
      }
      
      if (!streetName) {
        const streetNamePatterns = [
          /<ns2:streetName[^>]*>([^<]*)<\/ns2:streetName>/i,
          /<streetName[^>]*>([^<]*)<\/streetName>/i,
          /<[^:]*:streetName[^>]*>([^<]*)<\/[^:]*:streetName>/i
        ]
        for (const pattern of streetNamePatterns) {
          const match = responseText.match(pattern)
          if (match && match[1] && match[1].trim()) {
            streetName = match[1].trim()
            console.log('Found streetName via regex:', streetName)
            break
          }
        }
      }
      
      if (!houseNumber) {
        // For house number, we need to be more careful - look for "number" tag within address context
        // Try to find number tags that are within taxpayerAddress tags
        const addressSectionMatch = responseText.match(/<taxpayerAddress[^>]*>([\s\S]*?)<\/taxpayerAddress>/i)
        if (addressSectionMatch) {
          const addressSection = addressSectionMatch[1]
          const numberPatterns = [
            /<ns2:number[^>]*>([^<]*)<\/ns2:number>/i,
            /<number[^>]*>([^<]*)<\/number>/i
          ]
          for (const pattern of numberPatterns) {
            const match = addressSection.match(pattern)
            if (match && match[1] && match[1].trim()) {
              const trimmed = match[1].trim()
              // House numbers are typically short and alphanumeric
              // Exclude very long numbers (likely tax numbers or IDs)
              if (trimmed.length > 0 && trimmed.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(trimmed)) {
                // Additional check: if it's all digits and longer than 8, it's probably not a house number
                if (!(/^\d+$/.test(trimmed) && trimmed.length > 8)) {
                  houseNumber = trimmed
                  console.log('Found houseNumber via regex (in address context):', houseNumber)
                  break
                }
              }
            }
          }
        }
        
        // Fallback: try patterns on full text but with stricter validation
        if (!houseNumber) {
          const numberPatterns = [
            /<ns2:number[^>]*>([^<]*)<\/ns2:number>/i,
            /<number[^>]*>([^<]*)<\/number>/i
          ]
          for (const pattern of numberPatterns) {
            const matches = responseText.matchAll(new RegExp(pattern.source, 'gi'))
            for (const match of matches) {
              if (match && match[1] && match[1].trim()) {
                const trimmed = match[1].trim()
                // Very strict validation for house numbers
                if (trimmed.length > 0 && trimmed.length <= 20 && /^[0-9A-Za-z\/\-\.\s]+$/.test(trimmed)) {
                  // Exclude if it's all digits and longer than 8 (likely tax number or ID)
                  if (!(/^\d+$/.test(trimmed) && trimmed.length > 8)) {
                    // Prefer shorter values (house numbers are usually short)
                    if (!houseNumber || trimmed.length < houseNumber.length) {
                      houseNumber = trimmed
                    }
                  }
                }
              }
            }
          }
          if (houseNumber) {
            console.log('Found houseNumber via regex (fallback):', houseNumber)
          }
        }
      }
      
      if (!publicPlaceCategory) {
        const categoryPatterns = [
          /<ns2:publicPlaceCategory[^>]*>([^<]*)<\/ns2:publicPlaceCategory>/i,
          /<publicPlaceCategory[^>]*>([^<]*)<\/publicPlaceCategory>/i,
          /<[^:]*:publicPlaceCategory[^>]*>([^<]*)<\/[^:]*:publicPlaceCategory>/i
        ]
        for (const pattern of categoryPatterns) {
          const match = responseText.match(pattern)
          if (match && match[1] && match[1].trim()) {
            publicPlaceCategory = match[1].trim()
            console.log('Found publicPlaceCategory via regex:', publicPlaceCategory)
            break
          }
        }
      }
    }
    
    console.log('Address extraction results:', {
      postalCode: postalCode || '(empty)',
      city: city || '(empty)',
      streetName: streetName || '(empty)',
      houseNumber: houseNumber || '(empty)',
      publicPlaceCategory: publicPlaceCategory || '(empty)'
    })
    
    // Combine street name and category (e.g., "ZÁHONY" + "UTCA" = "ZÁHONY UTCA")
    let street = streetName
    if (streetName && publicPlaceCategory) {
      street = `${streetName} ${publicPlaceCategory}`
      console.log('Combined street:', street, 'from streetName:', streetName, 'and category:', publicPlaceCategory)
    } else if (publicPlaceCategory) {
      street = publicPlaceCategory
      console.log('Using only category for street:', street)
    } else if (streetName) {
      console.log('Using only streetName for street:', street)
    } else {
      console.log('No street data extracted')
    }
    
    // Always set country to Magyarország (Hungary)
    const country = 'Magyarország'

    // Extract taxpayer data
    const taxpayerData = {
      name: taxpayerName,
      postalCode: postalCode,
      city: city,
      street: street,
      houseNumber: houseNumber,
      country: country,
      taxNumber: cleanTaxNumber,
      valid: true
    }

    console.log('Extracted taxpayer data:', taxpayerData)
    console.log('Final validation - name exists:', !!taxpayerName, 'validity:', taxpayerValidity, 'funcCode:', funcCode)
    
    // Return success if we extracted a taxpayer name
    // According to documentation, if taxpayerValidity is false, there's no taxpayerData
    // But if we can extract a name, the taxpayer exists
    if (taxpayerName) {
      console.log('Returning success - taxpayer name found:', taxpayerName)
      return NextResponse.json({
        success: true,
        taxpayer: taxpayerData
      })
    }
    
    // If no name was extracted, check why and return appropriate error
    console.log('No taxpayer name extracted. Checking reasons...')
    console.log('taxpayerValidity:', taxpayerValidity, 'funcCode:', funcCode)
    
    // If validity is explicitly false, return error
    if (taxpayerValidity === 'false') {
      const errorMsg = 'Az adószám nem található a NAV rendszerében vagy érvénytelen'
      console.log('Returning error - taxpayer validity is false')
      return NextResponse.json(
        { error: errorMsg },
        { status: 404 }
      )
    }
    
    // Final fallback error
    const errorMsg = 'Az adószám nem található a NAV rendszerében vagy érvénytelen'
    console.log('Returning error - no name extracted')
    return NextResponse.json(
      { error: errorMsg },
      { status: 404 }
    )

  } catch (error: any) {
    console.error('Error querying taxpayer:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

