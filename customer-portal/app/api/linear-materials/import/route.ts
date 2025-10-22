import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    // Fetch references
    const { data: existingCodes } = await supabaseServer
      .from('machine_linear_material_map')
      .select('machine_code, linear_material_id')
      .eq('machine_type', 'Korpus')

    const codeMap = new Map(existingCodes?.map(mc => [mc.machine_code, mc.linear_material_id]) || [])

    const { data: brands } = await supabaseServer.from('brands').select('id, name').is('deleted_at', null)
    const { data: currencies } = await supabaseServer.from('currencies').select('id, name').is('deleted_at', null)
    const { data: vatRates } = await supabaseServer.from('vat').select('id, name, kulcs').is('deleted_at', null)
    const { data: partners } = await supabaseServer.from('partners').select('id, name').is('deleted_at', null)
    const { data: units } = await supabaseServer.from('units').select('id, name, shortform').is('deleted_at', null)
    const { data: mediaFiles } = await supabaseServer.from('media_files').select('original_filename, full_url')

    const brandMap = new Map(brands?.map(b => [b.name, b.id]) || [])
    const currencyMap = new Map(currencies?.map(c => [c.name, c.id]) || [])
    const vatMap = new Map(vatRates?.map(v => [`${v.name} (${v.kulcs}%)`, v.id]) || [])
    const partnerMap = new Map(partners?.map(p => [p.name, p.id]) || [])
    const unitMap = new Map(units?.map(u => [u.name, u.id]) || [])
    const filenameToUrlMap = new Map(mediaFiles?.map(mf => [mf.original_filename, mf.full_url]) || [])
    
    // Get current user for price history
    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    const { data: { user } } = await supabaseWithAuth.auth.getUser()

    let created = 0, updated = 0
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      try {
        const machineCode = row['Gépkód']?.toString().trim()
        const brandName = row['Márka']?.toString().trim()

        let brandId = brandMap.get(brandName)
        if (!brandId) {
          const { data: newBrand } = await supabaseServer.from('brands').insert({ name: brandName }).select('id').single()
          if (newBrand) {
            brandId = newBrand.id
            brandMap.set(brandName, brandId)
          }
        }

        const currencyName = row['Pénznem']?.toString().trim() || 'HUF'
        const currencyId = currencyMap.get(currencyName)
        
        const vatString = row['Adónem']?.toString().trim()
        const vatId = vatMap.get(vatString)
        
        const partnerName = row['Partner']?.toString().trim()
        const partnerId = partnerName ? partnerMap.get(partnerName) : null
        
        const unitName = row['Mértékegység']?.toString().trim()
        const unitId = unitName ? unitMap.get(unitName) : null
        
        // Handle image - map filename to URL
        const imageFilename = row['Kép']?.toString().trim()
        const imageUrl = imageFilename ? filenameToUrlMap.get(imageFilename) || null : null

        const linearMaterialData = {
          brand_id: brandId,
          name: row['Név']?.toString().trim(),
          type: row['Típus']?.toString().trim(),
          width: parseFloat(row['Szélesség (mm)']) || 0,
          length: parseFloat(row['Hossz (mm)']) || 0,
          thickness: parseFloat(row['Vastagság (mm)']) || 0,
          base_price: parseFloat(row['Beszerzési ár']) || 0,
          multiplier: parseFloat(row['Árrés szorzó']) || 1.38,
          partners_id: partnerId,
          units_id: unitId,
          currency_id: currencyId,
          vat_id: vatId,
          on_stock: row['Raktáron'] === 'Igen',
          active: row['Aktív'] === 'Igen',
          image_url: imageUrl
        }

        const existingId = codeMap.get(machineCode)

        if (existingId) {
          await supabaseServer.from('linear_materials').update(linearMaterialData).eq('id', existingId)
          await supabaseServer.from('machine_linear_material_map').update({ machine_code: machineCode }).eq('linear_material_id', existingId).eq('machine_type', 'Korpus')
          updated++
        } else {
          const { data: newMaterial } = await supabaseServer.from('linear_materials').insert(linearMaterialData).select('id').single()
          if (newMaterial) {
            await supabaseServer.from('machine_linear_material_map').insert({
              linear_material_id: newMaterial.id,
              machine_type: 'Korpus',
              machine_code: machineCode
            })
            created++
          }
        }
      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Hiba'}`)
      }
    }

    return NextResponse.json({ success: true, created, updated, errors })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}

