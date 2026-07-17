import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quote_id } = await params
    const body = await request.json()
    const { comment } = body

    if (comment !== null && typeof comment === 'string' && comment.length > 250) {
      return NextResponse.json(
        { error: 'A megjegyzés maximum 250 karakter lehet' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
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

    const {
      data: { user },
      error: userError
    } = await supabaseAuth.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role — fronttervezo_quotes még nincs authenticated RLS policy-vel
    const { data, error: updateError } = await supabaseServer
      .from('fronttervezo_quotes')
      .update({
        comment: comment || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', quote_id)
      .is('deleted_at', null)
      .select('id')

    if (updateError) {
      console.error('[fronttervezo comment]', updateError)
      return NextResponse.json(
        { error: 'Hiba történt a megjegyzés mentésekor', details: updateError.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Az ajánlat nem található' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fronttervezo comment]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
