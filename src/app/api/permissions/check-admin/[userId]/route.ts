import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // For now, return false for admin check since we can't access auth.users directly
    // In a real implementation, you would need to use Supabase Admin API or a different approach
    // This is a simplified version that assumes the first user is admin
    const isAdmin = false // TODO: Implement proper admin check

    return NextResponse.json({ isAdmin })

  } catch (error) {
    console.error('Error in check-admin API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
