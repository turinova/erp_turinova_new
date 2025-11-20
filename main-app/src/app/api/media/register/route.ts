import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/media/register - Register an already-uploaded file in media_files table
// This is idempotent - safe to call multiple times
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      original_filename,
      stored_filename,
      storage_path,
      full_url,
      size,
      mimetype,
      bucket = 'materials' // Default to materials for backward compatibility
    } = body

    // Validate required fields
    if (!original_filename || !stored_filename || !storage_path || !full_url) {
      return NextResponse.json(
        { error: 'Missing required fields: original_filename, stored_filename, storage_path, full_url' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser()

    // Check if record already exists (idempotent check)
    // Try by full_url first (most reliable)
    const { data: existingByUrl } = await supabaseServer
      .from('media_files')
      .select('id, original_filename, full_url')
      .eq('full_url', full_url)
      .maybeSingle()

    if (existingByUrl) {
      // Record already exists, return it
      console.log(`Media file already registered: ${existingByUrl.original_filename} (${existingByUrl.full_url})`)
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        mediaFile: existingByUrl
      })
    }

    // Also check by stored_filename (in case URL format changed)
    const { data: existingByFilename } = await supabaseServer
      .from('media_files')
      .select('id, original_filename, full_url')
      .eq('stored_filename', stored_filename)
      .maybeSingle()

    if (existingByFilename) {
      // Record already exists, return it
      console.log(`Media file already registered: ${existingByFilename.original_filename} (${existingByFilename.full_url})`)
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        mediaFile: existingByFilename
      })
    }

    // Insert new record
    const { data: newRecord, error: dbError } = await supabaseServer
      .from('media_files')
      .insert({
        original_filename: original_filename,
        stored_filename: stored_filename,
        storage_path: storage_path,
        full_url: full_url,
        size: size || 0,
        mimetype: mimetype || 'image/webp',
        uploaded_by: user?.id || null
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error registering media file:', dbError)
      return NextResponse.json(
        { error: 'Failed to register media file', details: dbError.message },
        { status: 500 }
      )
    }

    console.log(`Successfully registered media file: ${original_filename} -> ${full_url}`)

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      mediaFile: newRecord
    })

  } catch (error) {
    console.error('Error in media register API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

