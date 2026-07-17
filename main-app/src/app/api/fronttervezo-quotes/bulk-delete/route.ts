import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  try {
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

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteIds } = body

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott árajánlat' }, { status: 400 })
    }

    const { error: deleteError } = await supabaseServer
      .from('fronttervezo_quotes')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', quoteIds)
      .is('deleted_at', null)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Törlés sikertelen', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: quoteIds.length
    })
  } catch (error) {
    console.error('[fronttervezo bulk-delete]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
