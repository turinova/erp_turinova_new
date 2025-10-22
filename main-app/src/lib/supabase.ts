const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for client-side operations. Some features may not work.')
}

// Create a mock Supabase client for build time
const createMockSupabaseClient = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        is: () => ({
          single: () => ({ data: null, error: null })
        })
      }),
      is: () => ({
        order: () => ({ data: [], error: null })
      })
    })
  }),
  auth: {
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null })
  }
})

// Only import and use createBrowserClient if Supabase is configured
let supabase: any
if (isSupabaseConfigured) {
  try {
    const { createBrowserClient } = require('@supabase/ssr')
    supabase = createBrowserClient(supabaseUrl!, supabaseAnonKey!)
  } catch (error) {
    console.warn('Failed to create Supabase client, using mock:', error)
    supabase = createMockSupabaseClient()
  }
} else {
  supabase = createMockSupabaseClient()
}

export { supabase }

export type Material = {
  id: string
  name: string
  width_mm: number
  length_mm: number
  thickness_mm: number
  grain_direction: boolean
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  kerf_mm: number
  created_at: string
  updated_at: string
}
