import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * DELETE /api/products/[id]/sources/[sourceId]
 * Delete a source material
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params
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

    // Get source material to check file_url for deletion
    const { data: sourceMaterial } = await supabase
      .from('product_source_materials')
      .select('file_url')
      .eq('id', sourceId)
      .eq('product_id', id)
      .single()

    // Delete from database (cascade will delete chunks)
    const { error: deleteError } = await supabase
      .from('product_source_materials')
      .delete()
      .eq('id', sourceId)
      .eq('product_id', id)

    if (deleteError) {
      console.error('Error deleting source material:', deleteError)
      return NextResponse.json({ error: 'Failed to delete source material' }, { status: 500 })
    }

    // Delete file from storage if exists
    if (sourceMaterial?.file_url) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Extract file path from URL
      let filePath: string | null = null
      
      if (sourceMaterial.file_url.includes('/product-sources/')) {
        const urlParts = sourceMaterial.file_url.split('/product-sources/')
        if (urlParts.length > 1) {
          const pathWithQuery = urlParts[1]
          const pathOnly = pathWithQuery.split('?')[0]
          filePath = pathOnly.startsWith('sources/') ? pathOnly : `sources/${pathOnly}`
        }
      } else if (sourceMaterial.file_url.includes('product-sources')) {
        const match = sourceMaterial.file_url.match(/product-sources[\/](.+?)(?:\?|$)/)
        if (match && match[1]) {
          const pathOnly = match[1].split('?')[0]
          filePath = pathOnly.startsWith('sources/') ? pathOnly : `sources/${pathOnly}`
        }
      }

      if (filePath) {
        console.log('[DELETE] Removing file:', filePath)
        const { error: removeError } = await supabaseAdmin.storage
          .from('product-sources')
          .remove([filePath])
        
        if (removeError) {
          console.error('[DELETE] Error removing file:', removeError)
          // Don't fail the request if file deletion fails - database record is already deleted
        }
      } else {
        console.warn('[DELETE] Could not extract file path from URL:', sourceMaterial.file_url)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/products/[id]/sources/[sourceId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
