import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// DELETE - Bulk delete quotes
export async function DELETE(request: NextRequest) {
  try {
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteIds } = body

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'No quotes selected for deletion' }, { status: 400 })
    }

    console.log(`Bulk deleting ${quoteIds.length} quotes`)

    // Delete quotes (soft delete by setting deleted_at)
    const { error: deleteError } = await supabaseServer
      .from('quotes')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', quoteIds)

    if (deleteError) {
      console.error('Error deleting quotes:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete quotes',
        details: deleteError.message
      }, { status: 500 })
    }

    console.log(`Successfully deleted ${quoteIds.length} quotes`)
    
    return NextResponse.json({
      success: true,
      message: `${quoteIds.length} quotes deleted successfully`,
      deletedCount: quoteIds.length
    })

  } catch (error) {
    console.error('Error in bulk delete quotes:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
