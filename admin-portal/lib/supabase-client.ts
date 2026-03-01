import { createBrowserClient } from '@supabase/ssr'

// Admin portal Supabase configuration (Admin Database)
// Accept both NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

// Validate environment variables and create client
let supabase: ReturnType<typeof createBrowserClient>

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error(
      '❌ Missing Supabase environment variables!\n' +
      'Please ensure your .env.local file in the admin-portal directory has:\n' +
      'NEXT_PUBLIC_SUPABASE_URL=your-admin-db-url\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=your-admin-db-anon-key (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)\n' +
      'SUPABASE_SERVICE_ROLE_KEY=your-admin-db-service-role-key\n\n' +
      'These should point to your Admin Database (Turinova Admin Supabase project).'
    )
  }
  // Create a dummy client that will fail gracefully
  // This prevents the app from crashing on initial load
  supabase = createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
} else {
  // Create browser client using @supabase/ssr
  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export { supabase }

