import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// PATCH - Batch update all permissions for a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const body = await request.json()
    const { permissions } = body // Object with { pagePath: canAccess, ... }

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Permissions object required' }, { status: 400 })
    }

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

    console.log(`[BATCH PERMISSIONS] Updating ${Object.keys(permissions).length} permissions for user ${userId}`)

    // First, get all page IDs in a single query
    const pagePaths = Object.keys(permissions)
    const { data: pagesData, error: pagesError } = await supabase
      .from('pages')
      .select('id, path')
      .in('path', pagePaths)
      .eq('is_active', true)

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Create a map of path -> id for quick lookup
    const pageMap = new Map(pagesData?.map(p => [p.path, p.id]) || [])

    // Prepare batch upsert data
    const upsertData = Object.entries(permissions).map(([pagePath, canAccess]) => {
      const pageId = pageMap.get(pagePath)
      if (!pageId) {
        console.warn(`Page not found: ${pagePath}`)
        return null
      }
      return {
        user_id: userId,
        page_id: pageId,
        can_access: canAccess as boolean
      }
    }).filter(item => item !== null) // Remove null entries for pages not found

    if (upsertData.length === 0) {
      return NextResponse.json({ error: 'No valid permissions to update' }, { status: 400 })
    }

    console.log(`[BATCH PERMISSIONS] Upserting ${upsertData.length} permission records`)

    // Batch upsert all permissions in a single transaction
    const { error: upsertError } = await supabase
      .from('user_permissions')
      .upsert(upsertData, {
        onConflict: 'user_id,page_id'
      })

    if (upsertError) {
      console.error('Error batch updating permissions:', upsertError)
      return NextResponse.json({ 
        error: 'Failed to update permissions',
        details: upsertError.message 
      }, { status: 500 })
    }

    console.log(`[BATCH PERMISSIONS] Successfully updated ${upsertData.length} permissions`)

    // Single revalidation after all updates
    revalidatePath('/users')

    return NextResponse.json({ 
      success: true, 
      updated: upsertData.length 
    })

  } catch (error) {
    console.error('Error in batch permissions update:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

