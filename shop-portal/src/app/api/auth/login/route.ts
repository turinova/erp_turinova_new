/**
 * Login API Route
 * Handles two-step authentication for multi-tenant system
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth/central-auth'
import { storeTenantContext } from '@/lib/tenant-supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate user (two-step process)
    console.log('[LOGIN API] Attempting authentication for:', email)
    const authResult = await authenticateUser(email, password)
    console.log('[LOGIN API] Authentication result:', {
      type: authResult.type,
      hasUser: !!authResult.user,
      hasTenant: !!authResult.tenant,
      error: authResult.error
    })

    if (authResult.error || !authResult.user) {
      console.error('[LOGIN API] Authentication failed:', authResult.error)
      return NextResponse.json(
        { 
          success: false, 
          error: authResult.error || 'Invalid credentials' 
        },
        { status: 401 }
      )
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.user.id,
        email: authResult.user.email
      },
      type: authResult.type,
      tenant: authResult.tenant
    })

    // Store tenant context in cookie if tenant user
    if (authResult.type === 'tenant' && authResult.tenant) {
      const tenantContextJson = storeTenantContext(authResult.tenant)
      response.cookies.set('tenant_context', tenantContextJson, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    }

    // For tenant users, we also need to establish a session in the tenant database
    if (authResult.type === 'tenant' && authResult.tenant) {
      const cookieStore = await cookies()
      
      // Create tenant Supabase client
      const tenantSupabase = createServerClient(
        authResult.tenant.supabase_url,
        authResult.tenant.supabase_anon_key,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
                response.cookies.set(name, value, options)
              })
            },
          },
        }
      )

      // Sign in to tenant database to establish session
      const { error: signInError } = await tenantSupabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        console.error('Error signing in to tenant database:', signInError)
        // Continue anyway - the authentication was successful
      }
    }

    return response
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      },
      { status: 500 }
    )
  }
}
