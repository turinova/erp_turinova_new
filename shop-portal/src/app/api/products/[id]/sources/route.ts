import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/products/[id]/sources
 * Get all source materials for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get source materials
    const { data: sources, error } = await supabase
      .from('product_source_materials')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching source materials:', error)
      return NextResponse.json({ error: 'Failed to fetch source materials' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sources: sources || [] })
  } catch (error) {
    console.error('Error in GET /api/products/[id]/sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/sources
 * Upload/add a source material (PDF, URL, or text)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const sourceType = formData.get('source_type') as string
    const title = formData.get('title') as string | null
    const priority = formData.get('priority') ? parseInt(formData.get('priority') as string) : 5
    const weight = formData.get('weight') ? parseFloat(formData.get('weight') as string) : 1.0

    let sourceData: any = {
      product_id: id,
      source_type: sourceType,
      title: title || null,
      priority: priority,
      weight: weight,
      uploaded_by: user.id,
      processing_status: 'pending'
    }

    // Handle different source types
    if (sourceType === 'pdf') {
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}/${Date.now()}.${fileExt}`
      const filePath = `sources/${fileName}`

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('product-sources')
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('product-sources')
        .getPublicUrl(filePath)

      sourceData.file_url = publicUrl
      sourceData.file_name = file.name
      sourceData.file_size = file.size
      sourceData.mime_type = file.type

    } else if (sourceType === 'url') {
      const url = formData.get('url') as string
      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 })
      }
      sourceData.external_url = url

    } else if (sourceType === 'text') {
      const text = formData.get('text') as string
      if (!text) {
        return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
      }
      sourceData.text_content = text
      sourceData.processing_status = 'processed' // Text doesn't need processing
      sourceData.extracted_text = text
      sourceData.processed_at = new Date().toISOString()
    } else {
      return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
    }

    // Save to database
    const { data: sourceMaterial, error: insertError } = await supabase
      .from('product_source_materials')
      .insert(sourceData)
      .select()
      .single()

    if (insertError) {
      console.error('Error saving source material:', insertError)
      return NextResponse.json({ error: 'Failed to save source material' }, { status: 500 })
    }

    // If text, automatically process it (extract, chunk, embed)
    if (sourceType === 'text' && sourceMaterial) {
      // Process in background (don't await - let it run async)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/products/${id}/sources/${sourceMaterial.id}/process`, {
        method: 'POST'
      }).catch(err => {
        console.error('Error triggering text processing:', err)
        // Non-blocking - user will see status update on refresh
      })
    }

    return NextResponse.json({ 
      success: true, 
      sourceMaterial 
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

