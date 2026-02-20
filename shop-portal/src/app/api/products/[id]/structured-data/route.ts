import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  generateProductGroupStructuredData, 
  saveStructuredData, 
  getStructuredData 
} from '@/lib/structured-data-service'

/**
 * GET /api/products/[id]/structured-data
 * Get structured data (JSON-LD) for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'ProductGroup'

    // Get structured data
    const result = await getStructuredData(supabase, id, type)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Structured data not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      structuredData: result.jsonLd,
      type
    })
  } catch (error) {
    console.error('Error in GET /api/products/[id]/structured-data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch structured data'
    }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/structured-data
 * Generate and save structured data (JSON-LD) for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json().catch(() => ({}))
    const type = body.type || 'ProductGroup'

    // Generate structured data
    const result = await generateProductGroupStructuredData(supabase, id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate structured data' },
        { status: 400 }
      )
    }

    // Save to database
    const saveResult = await saveStructuredData(supabase, id, type, result.jsonLd)

    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: saveResult.error || 'Failed to save structured data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      structuredData: result.jsonLd,
      type,
      message: 'Structured data generated and saved successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/structured-data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate structured data'
    }, { status: 500 })
  }
}
