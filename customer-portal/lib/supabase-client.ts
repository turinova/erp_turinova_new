import { createBrowserClient } from '@supabase/ssr'

// Customer portal Supabase configuration
const supabaseUrl = 'https://oatbbtbkerxogzvwicxx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc'

// Create browser client using @supabase/ssr (same as main app)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
