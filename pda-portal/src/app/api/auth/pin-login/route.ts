import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    
    // Trim and validate PIN
    const trimmedPin = String(pin).trim()
    
    console.log('[PIN Login] Attempt:', trimmedPin)
    console.log('[PIN Login] Env check - URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('[PIN Login] Env check - Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')
    
    // Validate PIN format
    if (!trimmedPin || trimmedPin.length !== 6 || !/^\d{6}$/.test(trimmedPin)) {
      console.log('[PIN Login] Invalid format:', trimmedPin)
      return NextResponse.json(
        { error: 'Érvénytelen PIN' },
        { status: 400 }
      )
    }
    
    // Create Supabase admin client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[PIN Login] Missing environment variables')
      return NextResponse.json(
        { error: 'Szerver konfigurációs hiba' },
        { status: 500 }
      )
    }
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Check if PIN exists and is active using RPC (bypasses schema cache)
    const { data: pinDataArray, error: pinError } = await supabaseAdmin
      .rpc('lookup_user_pin', { pin_code: trimmedPin })
    
    // Log for debugging (check server terminal)
    if (pinError) {
      console.error('[PIN Login] RPC Error:', JSON.stringify(pinError, null, 2))
      return NextResponse.json(
        { error: 'Hibás PIN', details: pinError.message },
        { status: 401 }
      )
    }
    
    // RPC returns an array, get first result
    const pinData = pinDataArray && pinDataArray.length > 0 ? pinDataArray[0] : null
    
    if (!pinData) {
      console.log(`[PIN Login] PIN not found or inactive: ${trimmedPin}`)
      return NextResponse.json(
        { error: 'Hibás PIN' },
        { status: 401 }
      )
    }
    
    console.log(`[PIN Login] PIN found for user: ${pinData.user_id}`)
    
    // Check if locked
    if (pinData.locked_until && new Date(pinData.locked_until) > new Date()) {
      const lockTime = new Date(pinData.locked_until)
      const minutesLeft = Math.ceil((lockTime.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `PIN ideiglenesen zárolva. Próbálja újra ${minutesLeft} perc múlva.` },
        { status: 423 }
      )
    }
    
    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('id', pinData.user_id)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Felhasználó nem található' },
        { status: 404 }
      )
    }
    
    // Reset failed attempts and update last_used_at
    await supabaseAdmin
      .from('user_pins')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_used_at: new Date().toISOString()
      })
      .eq('user_id', pinData.user_id)
    
    // Generate JWT token
    const secret = new TextEncoder().encode(process.env.PDA_JWT_SECRET!)
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      workerId: pinData.worker_id || null,
      type: 'pda_session'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret)
    
    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        worker_id: pinData.worker_id || null
      }
    })
    
    // Set cookie - for localhost, don't set domain
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.turinova.hu' : undefined
    
    // Set cookie as session-only (no maxAge) so it's cleared when app closes
    // This forces PIN entry every time the app is opened
    response.cookies.set('pda_token', token, {
      ...(cookieDomain && { domain: cookieDomain }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // No maxAge - session cookie that expires when browser/app closes
      path: '/'
    })
    
    return response
    
  } catch (error) {
    console.error('PIN login error:', error)
    return NextResponse.json(
      { error: 'Belső hiba történt' },
      { status: 500 }
    )
  }
}

