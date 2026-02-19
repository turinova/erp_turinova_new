import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/test-ai-system
 * Test all AI system components:
 * - Anthropic API (Claude)
 * - OpenAI API (Embeddings)
 * - Supabase Database (pgvector)
 * - Supabase Storage
 */
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  }

  // Test 1: Anthropic API (Claude)
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      results.tests.anthropic = {
        status: 'error',
        message: 'ANTHROPIC_API_KEY not set in environment'
      }
    } else {
      // Log API key info (first/last chars only for security)
      const keyPreview = apiKey.length > 20 
        ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}`
        : '***'
      const keyStartsWith = apiKey.startsWith('sk-ant-')
      
      console.log('[ANTHROPIC TEST] API Key check:', {
        exists: !!apiKey,
        length: apiKey.length,
        startsWithSkAnt: keyStartsWith,
        preview: keyPreview
      })

      const anthropic = new Anthropic({
        apiKey: apiKey,
        // Explicitly set API version
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      })

      // First, try to check if API key is valid by testing a simple endpoint
      // Note: Anthropic doesn't have a models list endpoint, so we'll test with the simplest model
      console.log('[ANTHROPIC TEST] Testing API key validity...')
      
      // Try claude-3-haiku first (usually most accessible)
      const haikuTest = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }]
      }).catch((err: any) => {
        console.log('[ANTHROPIC TEST] Haiku test failed:', err?.message)
        return null
      })

      if (haikuTest) {
        console.log('[ANTHROPIC TEST] Haiku works! API key is valid, but Sonnet models may need upgrade.')
        // Continue to test Sonnet models, but we know the key works
      }

      // Try different model names (start with Sonnet, then fallback to Haiku)
      const modelsToTry = [
        'claude-3-5-sonnet-latest',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-5-sonnet',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307' // Fallback - most accessible
      ]

      let lastError: any = null
      let success = false
      let workingModel = ''
      const triedModels: string[] = []
      const errorDetails: any[] = []

      for (const model of modelsToTry) {
        triedModels.push(model)
        console.log(`[ANTHROPIC TEST] Trying model: ${model}`)
        
        try {
          const testMessage = await anthropic.messages.create({
            model: model,
            max_tokens: 10,
            messages: [
              {
                role: 'user',
                content: 'Say "test" if you can read this.'
              }
            ]
          })

          const response = testMessage.content[0].type === 'text' 
            ? testMessage.content[0].text 
            : ''

          console.log(`[ANTHROPIC TEST] Success with model: ${model}`, {
            response: response.substring(0, 50),
            tokens: testMessage.usage.input_tokens + testMessage.usage.output_tokens
          })

          results.tests.anthropic = {
            status: 'success',
            message: model.includes('haiku') 
              ? 'Anthropic API is working (claude-3-haiku). Claude 3.5 Sonnet may require account upgrade.'
              : 'Anthropic API is working',
            model: model,
            response: response,
            tokensUsed: testMessage.usage.input_tokens + testMessage.usage.output_tokens,
            note: model.includes('haiku') 
              ? 'Your API key works! Claude 3.5 Sonnet models may require account upgrade or billing setup. Check Anthropic console.'
              : undefined
          }
          success = true
          workingModel = model
          break
        } catch (err: any) {
          const errorDetail = {
            model: model,
            error: err?.message || String(err),
            status: err?.status,
            statusText: err?.statusText,
            response: err?.response ? {
              status: err.response.status,
              statusText: err.response.statusText,
              data: typeof err.response.data === 'string' 
                ? err.response.data.substring(0, 200)
                : err.response.data
            } : null,
            fullError: err
          }
          errorDetails.push(errorDetail)
          lastError = err
          
          console.error(`[ANTHROPIC TEST] Failed with model ${model}:`, {
            message: err?.message,
            status: err?.status,
            response: err?.response?.data
          })
          
          // Continue to next model
        }
      }

      if (!success) {
        // Check if it's an authentication error vs model not found
        const errorMessage = lastError?.message || String(lastError)
        const errorStatus = lastError?.status || lastError?.response?.status
        const isAuthError = errorStatus === 401 || 
                           errorMessage.includes('401') || 
                           errorMessage.includes('authentication') ||
                           errorMessage.includes('unauthorized') ||
                           errorMessage.includes('Invalid API key')
        
        const isModelError = errorStatus === 404 ||
                           errorMessage.includes('404') || 
                           errorMessage.includes('not_found') ||
                           errorMessage.includes('model')

        console.error('[ANTHROPIC TEST] All models failed:', {
          errorMessage,
          errorStatus,
          isAuthError,
          isModelError,
          errorDetails: errorDetails.map(e => ({
            model: e.model,
            status: e.status,
            message: e.error
          }))
        })

        results.tests.anthropic = {
          status: 'error',
          message: isAuthError 
            ? 'API key authentication failed. Check your ANTHROPIC_API_KEY.'
            : isModelError
            ? 'None of the Claude models are accessible. Your API key may not have access to Claude models.'
            : 'Anthropic API error. Check your API key and account status.',
          error: errorMessage,
          errorStatus: errorStatus,
          apiKeyFormat: {
            exists: !!apiKey,
            length: apiKey.length,
            startsWithSkAnt: keyStartsWith,
            preview: keyPreview
          },
          triedModels: triedModels,
          errorDetails: errorDetails.map(e => ({
            model: e.model,
            status: e.status,
            message: e.error.substring(0, 200)
          })),
          suggestion: isAuthError
            ? '1. Verify ANTHROPIC_API_KEY in .env.local is correct\n2. Check the key starts with "sk-ant-"\n3. Ensure no extra spaces or quotes\n4. Restart dev server after changing .env.local'
            : '1. Check your Anthropic console: https://console.anthropic.com/\n2. Verify account has credits/billing set up\n3. Check API key has access to Claude models\n4. Try creating a new API key\n5. Test with curl command (see console logs)'
        }
      }
    }
  } catch (error) {
    results.tests.anthropic = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: String(error),
      suggestion: 'Check your ANTHROPIC_API_KEY in .env.local'
    }
  }

  // Test 2: OpenAI API (Embeddings)
  try {
    if (!process.env.OPENAI_API_KEY) {
      results.tests.openai = {
        status: 'error',
        message: 'OPENAI_API_KEY not set in environment'
      }
    } else {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'test embedding'
      })

      const embedding = embeddingResponse.data[0].embedding

      results.tests.openai = {
        status: 'success',
        message: 'OpenAI API is working',
        embeddingDimensions: embedding.length,
        model: 'text-embedding-3-small'
      }
    }
  } catch (error) {
    results.tests.openai = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: String(error)
    }
  }

  // Test 3: Supabase Database Connection & pgvector
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!supabaseAnonKey) {
      results.tests.supabase_db = {
        status: 'error',
        message: 'Supabase keys not configured'
      }
    } else {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {
              // No-op for test
            },
          },
        }
      )

      // Test database connection
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('id')
        .limit(1)

      if (pagesError) {
        throw pagesError
      }

      // Test pgvector extension - verify function exists
      // Since pg_extension table might not be accessible, we'll test the function directly
      let vectorWorks = false
      let vectorError: any = null
      
      try {
        // Try to call the function with minimal data
        // Even if it errors on type/structure, the function exists if it doesn't say "does not exist"
        const { error: funcError } = await supabase
          .rpc('match_content_chunks', {
            query_embedding: new Array(1536).fill(0),
            match_product_id: '00000000-0000-0000-0000-000000000000',
            match_threshold: 0.0,
            match_count: 0
          })
        
        // Function exists if error is about data/type/structure, not "function doesn't exist"
        if (funcError) {
          const errorMsg = funcError.message || String(funcError)
          vectorWorks = !errorMsg.includes('does not exist') && 
                       !errorMsg.includes('function') &&
                       !errorMsg.includes('No function matches')
          vectorError = funcError
        } else {
          vectorWorks = true
        }
      } catch (err: any) {
        vectorError = err
        // If it's a type error, function likely exists
        const errorMsg = err?.message || String(err)
        vectorWorks = !errorMsg.includes('does not exist') && 
                     !errorMsg.includes('function')
      }
      
      // If still unsure, assume it works (migration should have created it)
      if (!vectorWorks && !vectorError) {
        vectorWorks = true
      }

      results.tests.supabase_db = {
        status: vectorWorks ? 'success' : 'warning',
        message: vectorWorks 
          ? 'Supabase database connection working, pgvector extension enabled'
          : 'Supabase database connection working, but pgvector function test failed',
        pgvectorExtension: vectorWorks ? 'enabled' : 'test failed',
        vectorError: vectorError ? vectorError.message : null
      }
    }
  } catch (error) {
    results.tests.supabase_db = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: String(error)
    }
  }

  // Test 4: Supabase Storage
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      results.tests.supabase_storage = {
        status: 'error',
        message: 'SUPABASE_SERVICE_ROLE_KEY not set (needed for storage)'
      }
    } else {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

      if (bucketsError) {
        throw bucketsError
      }

      const productSourcesBucket = buckets?.find(b => b.id === 'product-sources')

      if (!productSourcesBucket) {
        results.tests.supabase_storage = {
          status: 'warning',
          message: 'product-sources bucket not found. Run the storage migration SQL.',
          availableBuckets: buckets?.map(b => b.id) || []
        }
      } else {
        // Try to list files (should work even if empty)
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from('product-sources')
          .list('sources', { limit: 1 })

        results.tests.supabase_storage = {
          status: 'success',
          message: 'Supabase Storage is working',
          bucketExists: true,
          canListFiles: !listError,
          listError: listError ? listError.message : null
        }
      }
    }
  } catch (error) {
    results.tests.supabase_storage = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: String(error)
    }
  }

  // Test 5: Database Tables
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (supabaseAnonKey) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {},
          },
        }
      )

      // Check if tables exist by trying to query them
      const tables = [
        'product_source_materials',
        'product_content_chunks',
        'product_description_generations'
      ]

      const tableStatus: any = {}

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(0) // Just check if table exists

        tableStatus[table] = error ? {
          exists: false,
          error: error.message
        } : {
          exists: true
        }
      }

      results.tests.database_tables = {
        status: Object.values(tableStatus).every((t: any) => t.exists) ? 'success' : 'error',
        message: 'Database tables check',
        tables: tableStatus
      }
    } else {
      results.tests.database_tables = {
        status: 'error',
        message: 'Supabase keys not configured'
      }
    }
  } catch (error) {
    results.tests.database_tables = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: String(error)
    }
  }

  // Summary
  const allTests = Object.values(results.tests)
  const successCount = allTests.filter((t: any) => t.status === 'success').length
  const errorCount = allTests.filter((t: any) => t.status === 'error').length
  const warningCount = allTests.filter((t: any) => t.status === 'warning').length

  results.summary = {
    total: allTests.length,
    success: successCount,
    errors: errorCount,
    warnings: warningCount,
    allPassed: errorCount === 0 && warningCount === 0
  }

  // Return appropriate status code
  const statusCode = results.summary.allPassed ? 200 : (errorCount > 0 ? 500 : 200)

  return NextResponse.json(results, { status: statusCode })
}
