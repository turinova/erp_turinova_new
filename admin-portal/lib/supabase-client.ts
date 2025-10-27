import { createBrowserClient } from '@supabase/ssr'

// Admin portal Supabase configuration (customer-portal-prod database)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create browser client using @supabase/ssr
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

