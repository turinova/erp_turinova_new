import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * DELETE - Bulk delete portal quotes
 * Customer portal version - deletes quotes for authenticated portal customer
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('[Portal Quotes Bulk Delete] Starting deletion...')
    
    // Get user from cookies for authentication
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              console.error('[Portal Quotes Bulk Delete] Error setting cookies:', error)
            }
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('[Portal Quotes Bulk Delete] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteIds } = body

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'No quotes selected for deletion' }, { status: 400 })
    }

    console.log(`[Portal Quotes Bulk Delete] Deleting ${quoteIds.length} quotes for customer ${user.id}`)

    // Delete quotes - RLS policy ensures only customer's own quotes can be deleted
    // CASCADE will automatically delete related records (panels, pricing, edges, services)
    const { error: deleteError, count } = await supabase
      .from('portal_quotes')
      .delete({ count: 'exact' })
      .eq('portal_customer_id', user.id) // Ensure only deleting own quotes
      .in('id', quoteIds)

    if (deleteError) {
      console.error('[Portal Quotes Bulk Delete] Error deleting quotes:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete quotes',
        details: deleteError.message
      }, { status: 500 })
    }

    console.log(`[Portal Quotes Bulk Delete] Successfully deleted ${count || 0} quotes`)
    
    return NextResponse.json({
      success: true,
      message: `${count || 0} quotes deleted successfully`,
      deletedCount: count || 0
    }, { status: 200 })

  } catch (error) {
    console.error('[Portal Quotes Bulk Delete] Error in bulk delete:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

