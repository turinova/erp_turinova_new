import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
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

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

  } catch (error) {
    console.error('Error in workers API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const { name, nickname, mobile, color } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Név megadása kötelező' }, { status: 400 })
    }

    const insertData = {
      name: name.trim(),
      nickname: nickname?.trim() || null,
      mobile: mobile?.trim() || null,
      color: color?.trim() || '#1976d2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('workers')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating worker:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozó létrehozása során' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('Error in workers POST API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
