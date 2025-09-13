import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory storage for permissions (will reset on server restart)
const permissionStorage = new Map<string, any[]>()

// Fast local permission system - no database needed
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  
  try {
    const permissions = permissionStorage.get(userId) || []
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Permission API error:', error)
    return NextResponse.json({ permissions: [] })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const body = await request.json()
  
  try {
    if (body.permissions && body.permissions.length > 0) {
      permissionStorage.set(userId, body.permissions)
    } else {
      permissionStorage.delete(userId)
    }
    
    return NextResponse.json({ success: true, message: 'Permissions saved successfully' })
  } catch (error) {
    console.error('Permission save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
