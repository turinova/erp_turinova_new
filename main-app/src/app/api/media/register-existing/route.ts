import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/media/register-existing - Register an existing uploaded file in media_files table
// Useful for backfilling images uploaded before registration was implemented
// Requires: full_url and original_filename
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      full_url,
      original_filename
    } = body

    // Validate required fields
    if (!full_url || !original_filename) {
      return NextResponse.json(
        { error: 'Missing required fields: full_url, original_filename' },
        { status: 400 }
      )
    }

    // Extract stored_filename and storage_path from full_url
    const urlParts = full_url.split('/')
    const storedFilename = urlParts[urlParts.length - 1]
    
    // Determine bucket and path from URL
    let storagePath = ''
    let bucket = 'materials'
    
    if (full_url.includes('/accessories/accessories/')) {
      bucket = 'accessories'
      storagePath = `accessories/${storedFilename}`
    } else if (full_url.includes('/materials/materials/')) {
      bucket = 'materials'
      storagePath = `materials/${storedFilename}`
    } else {
      return NextResponse.json(
        { error: 'Unable to determine bucket from URL. URL must contain /accessories/accessories/ or /materials/materials/' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser()

    // Check if record already exists (idempotent check)
    const { data: existingByUrl } = await supabaseServer
      .from('media_files')
      .select('id, original_filename, full_url')
      .eq('full_url', full_url)
      .maybeSingle()

    if (existingByUrl) {
      // Update original_filename if it's different
      if (existingByUrl.original_filename !== original_filename) {
        const { data: updated } = await supabaseServer
          .from('media_files')
          .update({ original_filename: original_filename })
          .eq('id', existingByUrl.id)
          .select()
          .single()
        
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          updated: true,
          mediaFile: updated
        })
      }
      
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        updated: false,
        mediaFile: existingByUrl
      })
    }

    // Insert new record
    const { data: newRecord, error: dbError } = await supabaseServer
      .from('media_files')
      .insert({
        original_filename: original_filename,
        stored_filename: storedFilename,
        storage_path: storagePath,
        full_url: full_url,
        size: 0, // Size unknown for existing files
        mimetype: 'image/webp', // Default, can be updated later
        uploaded_by: user?.id || null
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error registering existing media file:', dbError)
      return NextResponse.json(
        { error: 'Failed to register media file', details: dbError.message },
        { status: 500 }
      )
    }

    console.log(`Successfully registered existing media file: ${original_filename} -> ${full_url}`)

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      mediaFile: newRecord
    })

  } catch (error) {
    console.error('Error in register-existing API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

