import { NextRequest, NextResponse } from 'next/server'
import { getCompanyById, createAdminClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const timestamp = new Date().toISOString()
  
  const debugInfo: any = {
    timestamp,
    companyId: resolvedParams.id,
    environment: process.env.VERCEL_ENV || 'local',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + '...',
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    steps: []
  }
  
  try {
    // Step 1: Test admin client creation
    debugInfo.steps.push({ step: 1, action: 'Creating admin client...' })
    const supabase = createAdminClient()
    debugInfo.steps.push({ step: 1, result: '✅ Admin client created' })
    
    // Step 2: Test direct query
    debugInfo.steps.push({ step: 2, action: 'Querying companies table...' })
    const { data: allCompanies, error: listError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5)
    
    if (listError) {
      debugInfo.steps.push({ 
        step: 2, 
        result: '❌ List query failed', 
        error: {
          message: listError.message,
          code: listError.code,
          details: listError.details,
          hint: listError.hint
        }
      })
    } else {
      debugInfo.steps.push({ 
        step: 2, 
        result: '✅ List query succeeded', 
        count: allCompanies?.length || 0,
        companies: allCompanies
      })
    }
    
    // Step 3: Test specific company query
    debugInfo.steps.push({ step: 3, action: `Querying company ${resolvedParams.id}...` })
    const { data: specificCompany, error: specificError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', resolvedParams.id)
      .single()
    
    if (specificError) {
      debugInfo.steps.push({ 
        step: 3, 
        result: '❌ Specific query failed', 
        error: {
          message: specificError.message,
          code: specificError.code,
          details: specificError.details,
          hint: specificError.hint
        }
      })
    } else {
      debugInfo.steps.push({ 
        step: 3, 
        result: '✅ Specific query succeeded', 
        company: specificCompany
      })
    }
    
    // Step 4: Test getCompanyById function
    debugInfo.steps.push({ step: 4, action: 'Testing getCompanyById function...' })
    const company = await getCompanyById(resolvedParams.id)
    debugInfo.steps.push({ 
      step: 4, 
      result: company ? '✅ getCompanyById returned data' : '❌ getCompanyById returned null',
      company: company
    })
    
    debugInfo.summary = {
      canCreateAdminClient: true,
      canListCompanies: !listError,
      canQuerySpecificCompany: !specificError,
      getCompanyByIdWorks: !!company
    }
    
    return NextResponse.json(debugInfo, { status: 200 })
    
  } catch (error) {
    debugInfo.steps.push({ 
      step: 'error', 
      result: '💥 Exception caught',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    })
    
    return NextResponse.json(debugInfo, { status: 500 })
  }
}

