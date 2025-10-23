import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quote_id } = await params
    const body = await request.json()
    const { comment } = body

    console.log('[COMMENT API] Updating quote:', quote_id)
    console.log('[COMMENT API] Comment value:', comment)
    console.log('[COMMENT API] Comment length:', comment?.length || 0)

    // Validate comment length (max 250 characters)
    if (comment !== null && typeof comment === 'string' && comment.length > 250) {
      console.log('[COMMENT API] Comment too long, rejecting')
      return NextResponse.json(
        { error: 'A megjegyzés maximum 250 karakter lehet' },
        { status: 400 }
      )
    }

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
          },
        },
      }
    )

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update quote comment
    console.log('[COMMENT API] Executing update for quote_id:', quote_id)
    const { data, error: updateError } = await supabase
      .from('quotes')
      .update({
        comment: comment || null, // Store null if empty string
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote_id)
      .is('deleted_at', null)
      .select()

    console.log('[COMMENT API] Update result - data:', data)
    console.log('[COMMENT API] Update result - error:', updateError)

    if (updateError) {
      console.error('[COMMENT API] Error updating quote comment:', updateError)
      return NextResponse.json(
        { error: 'Hiba történt a megjegyzés mentésekor' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.error('[COMMENT API] No rows updated! Quote might not exist or already deleted.')
      return NextResponse.json(
        { error: 'Árajánlat nem található vagy már törölve' },
        { status: 404 }
      )
    }

    console.log('[COMMENT API] Successfully updated comment for quote:', quote_id)
    return NextResponse.json({
      success: true,
      message: 'Megjegyzés sikeresen mentve',
    })
  } catch (error) {
    console.error('Error updating quote comment:', error)
    return NextResponse.json(
      { error: 'Hiba történt a megjegyzés mentésekor' },
      { status: 500 }
    )
  }
}

