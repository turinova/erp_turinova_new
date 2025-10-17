import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/media - List all images from media_files table
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching media files from database...')
    const startTime = performance.now()

    // Fetch all media files from database
    const { data: files, error } = await supabaseServer
      .from('media_files')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    const queryTime = performance.now() - startTime
    console.log(`Media files query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching media files:', error)
      return NextResponse.json({ error: 'Failed to fetch media files' }, { status: 500 })
    }

    // Transform to match expected format
    const transformedFiles = files?.map(file => ({
      id: file.id,
      name: file.original_filename,  // Show original filename
      storedName: file.stored_filename,  // Include stored name for reference
      path: file.storage_path,
      fullUrl: file.full_url,
      size: file.size,
      created_at: file.created_at,
      updated_at: file.updated_at
    })) || []

    console.log(`Found ${transformedFiles.length} media files`)

    return NextResponse.json(transformedFiles)
  } catch (error) {
    console.error('Error in media API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/media - Delete selected media files (from both storage and database)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds } = body  // Changed from filePaths to fileIds (media_files table IDs)

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'No files selected for deletion' }, { status: 400 })
    }

    console.log(`Deleting ${fileIds.length} media files...`)

    // Fetch file records from database to get storage paths
    const { data: mediaFiles, error: fetchError } = await supabaseServer
      .from('media_files')
      .select('*')
      .in('id', fileIds)

    if (fetchError) {
      console.error('Error fetching media files for deletion:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    if (!mediaFiles || mediaFiles.length === 0) {
      return NextResponse.json({ error: 'Files not found in database' }, { status: 404 })
    }

    const storagePaths = mediaFiles.map(f => f.storage_path)
    console.log('Storage paths to delete:', storagePaths)

    // Delete from storage
    const { data: storageData, error: storageError } = await supabaseServer
      .storage
      .from('materials')
      .remove(storagePaths)

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      // Continue to delete from database even if storage fails (file might already be gone)
    }

    console.log(`Storage delete response:`, storageData?.length || 0, 'files deleted')

    // Delete from database
    const { error: dbError } = await supabaseServer
      .from('media_files')
      .delete()
      .in('id', fileIds)

    if (dbError) {
      console.error('Error deleting from database:', dbError)
      return NextResponse.json({ error: 'Failed to delete from database' }, { status: 500 })
    }

    console.log(`Successfully deleted ${fileIds.length} files from storage and database`)

    return NextResponse.json({ 
      success: true, 
      deleted: fileIds.length,
      message: `${fileIds.length} fájl sikeresen törölve`
    })
  } catch (error) {
    console.error('Error in media DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

