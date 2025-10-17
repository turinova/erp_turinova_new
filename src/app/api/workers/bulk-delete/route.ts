import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott dolgozó' }, { status: 400 })
    }

    // Soft delete multiple workers
    const { error } = await supabase
      .from('workers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .is('deleted_at', null)

    if (error) {
      console.error('Error bulk deleting workers:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozók törlése során' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `${ids.length} dolgozó sikeresen törölve`,
      deletedCount: ids.length 
    })

  } catch (error) {
    console.error('Error in workers bulk delete API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
