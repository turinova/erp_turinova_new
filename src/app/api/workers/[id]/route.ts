import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
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

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('id', resolvedParams.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching worker:', error)
      return NextResponse.json({ error: 'Dolgozó nem található' }, { status: 404 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in worker GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
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
    const { name, nickname, mobile, color } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Név megadása kötelező' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workers')
      .update({
        name: name.trim(),
        nickname: nickname?.trim() || null,
        mobile: mobile?.trim() || null,
        color: color?.trim() || '#1976d2',
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Error updating worker:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozó frissítése során' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in worker PUT API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
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

    // Soft delete
    const { error } = await supabase
      .from('workers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error deleting worker:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozó törlése során' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Dolgozó sikeresen törölve' })

  } catch (error) {
    console.error('Error in worker DELETE API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
