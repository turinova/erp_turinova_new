import { NextRequest, NextResponse } from 'next/server'
import { testSupabaseConnection } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// POST /api/tenants/test-connection - Test Supabase connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, anonKey, serviceRoleKey } = body

    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'URL and Anon Key are required' },
        { status: 400 }
      )
    }

    // Test anon key connection
    const anonTest = await testSupabaseConnection(url, anonKey)
    if (!anonTest.success) {
      return NextResponse.json({
        success: false,
        error: `Anon Key test failed: ${anonTest.error}`,
        anonKeyValid: false,
        serviceRoleKeyValid: null,
        schemaValid: false,
        missingTables: null
      })
    }

    // Test service role key if provided
    let serviceRoleTest = { success: true, error: null }
    if (serviceRoleKey) {
      try {
        const serviceClient = createClient(url, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Try to query a table that should exist
        const { error } = await serviceClient.from('users').select('id').limit(1)

        if (error) {
          serviceRoleTest = { success: false, error: error.message }
        }
      } catch (error: any) {
        serviceRoleTest = { success: false, error: error.message }
      }
    }

    // Verify database schema (check for required tables)
    let schemaValid = false
    let missingTables: string[] = []
    
    if (serviceRoleKey && serviceRoleTest.success) {
      try {
        const serviceClient = createClient(url, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Check for required tables
        const requiredTables = ['users', 'products', 'webshop_connections']
        const tableChecks = await Promise.all(
          requiredTables.map(async (table) => {
            const { error } = await serviceClient
              .from(table)
              .select('id')
              .limit(1)
            return { table, exists: !error || !error.message.includes('does not exist') }
          })
        )

        missingTables = tableChecks
          .filter(check => !check.exists)
          .map(check => check.table)
        
        schemaValid = missingTables.length === 0
      } catch (error: any) {
        // Schema check failed, but connection works
        schemaValid = false
      }
    }

    return NextResponse.json({
      success: true,
      anonKeyValid: anonTest.success,
      serviceRoleKeyValid: serviceRoleKey ? serviceRoleTest.success : null,
      schemaValid,
      missingTables: missingTables.length > 0 ? missingTables : null,
      message: schemaValid 
        ? 'Connection successful and database schema verified'
        : missingTables.length > 0
        ? `Connection successful but missing tables: ${missingTables.join(', ')}`
        : 'Connection successful'
    })
  } catch (error: any) {
    console.error('[API] Error testing connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test connection' },
      { status: 500 }
    )
  }
}
