import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { suggestion_text, title, rating } = body

    // Validation
    if (!suggestion_text) {
      return NextResponse.json(
        { error: 'Suggestion text is required' },
        { status: 400 }
      )
    }

    if (typeof suggestion_text !== 'string' || suggestion_text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Suggestion text must be at least 50 characters' },
        { status: 400 }
      )
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating is required and must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Use provided title or generate from first 100 chars of suggestion text
    const trimmedText = suggestion_text.trim()
    const suggestionTitle = title?.trim() || trimmedText.substring(0, 100)

    // Insert suggestion
    const { data, error } = await supabase
      .from('portal_suggestions')
      .insert({
        portal_customer_id: user.id,
        title: suggestionTitle,
        suggestion_text: trimmedText,
        rating: rating
      })
      .select()
      .single()

    if (error) {
      console.error('[Suggestions API] Error inserting suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to save suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )

  } catch (error) {
    console.error('[Suggestions API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

