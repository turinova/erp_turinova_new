import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/media/migrate - Migrate existing files from storage to media_files table
// This is a one-time migration to populate the media_files table with existing images
export async function POST(request: NextRequest) {
  try {
    console.log('Starting media files migration...')

    // Get current user (optional - for tracking who ran migration)
    const { data: { user } } = await supabaseServer.auth.getUser()
    const uploadedBy = user?.id || null

    // List all files from materials/materials/ folder
    const { data: files, error: listError } = await supabaseServer
      .storage
      .from('materials')
      .list('materials', {
        limit: 1000,
        offset: 0
      })

    if (listError) {
      console.error('Error listing files:', listError)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    console.log(`Found ${files?.length || 0} files in storage`)

    const results = {
      migrated: 0,
      skipped: 0,
      failed: [] as string[]
    }

    for (const file of files || []) {
      try {
        // Skip placeholder files
        if (file.name === '.emptyFolderPlaceholder') {
          results.skipped++
          continue
        }

        // Extract original filename (try to remove UUID-timestamp pattern)
        // Pattern: material-id-timestamp.webp or temp-timestamp1-timestamp2.webp
        let originalFilename = file.name
        
        // If filename starts with UUID or 'temp-', try to extract a cleaner name
        // For now, we'll use the stored filename as original (user can rename later)
        // TODO: Implement smarter extraction if needed
        
        const storedFilename = file.name
        const storagePath = `materials/${file.name}`
        const fullUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materials/materials/${file.name}`
        const size = file.metadata?.size || 0

        // Check if already migrated
        const { data: existing } = await supabaseServer
          .from('media_files')
          .select('id')
          .eq('stored_filename', storedFilename)
          .single()

        if (existing) {
          console.log(`Skipping ${storedFilename} - already migrated`)
          results.skipped++
          continue
        }

        // Insert into media_files table
        const { error: insertError } = await supabaseServer
          .from('media_files')
          .insert({
            original_filename: originalFilename,
            stored_filename: storedFilename,
            storage_path: storagePath,
            full_url: fullUrl,
            size: size,
            mimetype: file.metadata?.mimetype || 'image/webp',
            uploaded_by: uploadedBy
          })

        if (insertError) {
          console.error(`Failed to migrate ${storedFilename}:`, insertError)
          results.failed.push(storedFilename)
        } else {
          console.log(`Migrated: ${storedFilename}`)
          results.migrated++
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        results.failed.push(file.name)
      }
    }

    console.log('Migration complete:', results)

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.failed.length} failed`,
      results
    })
  } catch (error) {
    console.error('Error in media migration:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}

