import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
  try {
    // Get token from cookie
    const token = req.cookies.get('pda_token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(process.env.PDA_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    
    const workerId = payload.workerId as string | null
    
    if (!workerId) {
      return NextResponse.json(
        { error: 'No worker ID found in token' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      worker_id: workerId
    })

  } catch (error) {
    console.error('Error fetching worker ID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

