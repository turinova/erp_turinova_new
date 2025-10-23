import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const { comment } = body

    console.log('[PORTAL COMMENT API] Updating portal quote:', quoteId)
    console.log('[PORTAL COMMENT API] Comment value:', comment)
    console.log('[PORTAL COMMENT API] Comment length:', comment?.length || 0)

    // Validate comment length (max 250 characters)
    if (comment !== null && typeof comment === 'string' && comment.length > 250) {
      console.log('[PORTAL COMMENT API] Comment too long, rejecting')
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

    // Get current user (portal customer)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[PORTAL COMMENT API] Unauthorized:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[PORTAL COMMENT API] User ID:', user.id)

    // Verify quote belongs to user and is draft
    const { data: existingQuote, error: checkError } = await supabase
      .from('portal_quotes')
      .select('id, status, portal_customer_id')
      .eq('id', quoteId)
      .eq('portal_customer_id', user.id)
      .single()

    if (checkError || !existingQuote) {
      console.error('[PORTAL COMMENT API] Quote not found or not owned by user:', checkError)
      return NextResponse.json(
        { error: 'Árajánlat nem található vagy nincs hozzáférésed' },
        { status: 404 }
      )
    }

    if (existingQuote.status !== 'draft') {
      console.error('[PORTAL COMMENT API] Quote is not draft, cannot edit comment')
      return NextResponse.json(
        { error: 'Csak piszkozat státuszú árajánlathoz lehet megjegyzést hozzáadni' },
        { status: 403 }
      )
    }

    // Update portal quote comment
    console.log('[PORTAL COMMENT API] Executing update for quote_id:', quoteId)
    const { data, error: updateError } = await supabase
      .from('portal_quotes')
      .update({
        comment: comment || null, // Store null if empty string
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('portal_customer_id', user.id) // Extra security check
      .select()

    console.log('[PORTAL COMMENT API] Update result - data:', data)
    console.log('[PORTAL COMMENT API] Update result - error:', updateError)

    if (updateError) {
      console.error('[PORTAL COMMENT API] Error updating comment:', updateError)
      return NextResponse.json(
        { error: 'Hiba történt a megjegyzés mentésekor' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.error('[PORTAL COMMENT API] No rows updated!')
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    console.log('[PORTAL COMMENT API] Successfully updated comment for portal quote:', quoteId)
    return NextResponse.json({
      success: true,
      message: 'Megjegyzés sikeresen mentve',
    })
  } catch (error) {
    console.error('[PORTAL COMMENT API] Exception:', error)
    return NextResponse.json(
      { error: 'Hiba történt a megjegyzés mentésekor' },
      { status: 500 }
    )
  }
}

