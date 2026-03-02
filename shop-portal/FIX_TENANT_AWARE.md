# Tenant-Aware Database Migration

## Summary
All Supabase client creation must use `getTenantSupabase()` instead of default connection. This ensures each tenant only accesses their own database.

## Pattern to Replace

### OLD (WRONG):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const cookieStore = await cookies()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey!,
  {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  }
)
```

### NEW (CORRECT):
```typescript
import { getTenantSupabase } from '@/lib/tenant-supabase'

// Get tenant-aware Supabase client - CRITICAL: No fallback to default database
const supabase = await getTenantSupabase()
```

## Files Fixed
- ✅ `lib/supabase-server.ts` - Removed fallback
- ✅ `app/(dashboard)/users/actions.ts` - Uses tenant service role key
- ✅ `app/(dashboard)/connections/actions.ts` - Uses tenant-aware client
- ✅ `app/api/competitors/route.ts` - Uses tenant-aware client
- ✅ `app/api/competitors/[id]/route.ts` - Uses tenant-aware client
- ✅ `app/api/vat-rates/[id]/route.ts` - Uses tenant-aware client
- ✅ `app/api/connections/[id]/route.ts` - Uses tenant-aware client
- ✅ `app/api/permissions/user/[userId]/route.ts` - Uses tenant-aware client
- ✅ `app/api/permissions/user/[userId]/batch/route.ts` - Uses tenant-aware client

## Files Still Needing Fix
See grep output for remaining files using `process.env.NEXT_PUBLIC_SUPABASE_URL`
