import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie' }, { status: 400 })
    }

    console.log(`Changing password for user ${user.email}`)

    // Verify current password by attempting to sign in with it
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (verifyError) {
      console.error('Current password verification failed:', verifyError)
      return NextResponse.json({ error: 'A jelenlegi jelszó helytelen' }, { status: 400 })
    }

    // Update password using Supabase auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json({ error: updateError.message || 'Jelszó változtatás sikertelen' }, { status: 500 })
    }

    console.log('Password updated successfully!')
    return NextResponse.json({ message: 'Jelszó sikeresen megváltoztatva!' })

  } catch (error: any) {
    console.error('Unexpected error in change-password:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

