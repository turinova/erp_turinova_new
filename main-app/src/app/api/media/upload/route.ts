import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB in bytes

// POST /api/media/upload - Upload multiple images to materials bucket and save to media_files table
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser()

    console.log(`Uploading ${files.length} files to materials bucket...`)

    const results = {
      uploaded: [] as string[],
      failed: [] as { filename: string; error: string }[]
    }

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`)
        
        // Validate file type - allow webp and png
        const isWebp = file.type.includes('webp') || file.name.toLowerCase().endsWith('.webp')
        const isPng = file.type.includes('png') || file.name.toLowerCase().endsWith('.png')
        
        console.log(`File validation - isWebp: ${isWebp}, isPng: ${isPng}`)
        
        if (!isWebp && !isPng) {
          console.log(`File rejected: ${file.name} - type: ${file.type}`)
          results.failed.push({
            filename: file.name,
            error: 'Csak .webp és .png fájlok engedélyezettek'
          })
          continue
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          results.failed.push({
            filename: file.name,
            error: `Fájl méret túl nagy (max 1 MB), kapott: ${(file.size / 1024 / 1024).toFixed(2)} MB`
          })
          continue
        }

        // Keep original filename
        const originalFilename = file.name
        
        // Generate unique stored filename (timestamp + sanitized name)
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const storedFilename = `${timestamp}-${sanitizedName}`

        // Upload to materials/materials/ folder
        const { error: uploadError } = await supabaseServer
          .storage
          .from('materials')
          .upload(`materials/${storedFilename}`, file, {
            contentType: file.type,
            upsert: false
          })

        if (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError)
          results.failed.push({
            filename: file.name,
            error: uploadError.message || 'Feltöltés sikertelen'
          })
          continue
        }

        // Save to media_files table
        const storagePath = `materials/${storedFilename}`
        const fullUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materials/materials/${storedFilename}`

        const { error: dbError } = await supabaseServer
          .from('media_files')
          .insert({
            original_filename: originalFilename,
            stored_filename: storedFilename,
            storage_path: storagePath,
            full_url: fullUrl,
            size: file.size,
            mimetype: file.type,
            uploaded_by: user?.id || null
          })

        if (dbError) {
          console.error(`Error saving ${file.name} to database:`, dbError)
          // Try to delete the uploaded file from storage since DB insert failed
          await supabaseServer.storage.from('materials').remove([storagePath])
          results.failed.push({
            filename: file.name,
            error: 'Database mentés sikertelen'
          })
        } else {
          results.uploaded.push(file.name)
          console.log(`Successfully uploaded and saved: ${file.name}`)
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err)
        results.failed.push({
          filename: file.name,
          error: 'Ismeretlen hiba történt'
        })
      }
    }

    console.log(`Upload complete: ${results.uploaded.length} successful, ${results.failed.length} failed`)

    return NextResponse.json({
      success: results.failed.length === 0,
      uploaded: results.uploaded.length,
      failed: results.failed.length,
      uploadedFiles: results.uploaded,
      errors: results.failed
    })
  } catch (error) {
    console.error('Error in media upload API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

