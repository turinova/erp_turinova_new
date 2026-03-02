# Tenant-Aware Supabase Client Migration Progress

## Phase 1: Critical Fixes ✅ COMPLETED
- ✅ `shop-portal/src/app/(dashboard)/subscription/page.tsx` - Fixed subscription page 404

## Phase 2: Server Components ✅ COMPLETED
- ✅ `shop-portal/src/app/(dashboard)/subscription/page.tsx`
- ✅ `shop-portal/src/app/(dashboard)/vat/page.tsx`
- ✅ `shop-portal/src/app/(dashboard)/competitors/dashboard/page.tsx`
- ✅ `shop-portal/src/app/(dashboard)/competitors/links/page.tsx`
- ✅ Other pages use server libraries (already fixed or will be fixed in Phase 4)

## Phase 3: API Routes 🔄 IN PROGRESS

### ✅ Updated (Critical Routes):
- ✅ `shop-portal/src/app/api/vat-rates/route.ts` (GET, POST)
- ✅ `shop-portal/src/app/api/connections/route.ts` (GET, POST)
- ✅ `shop-portal/src/app/api/products/[id]/generate-meta/route.ts`
- ✅ `shop-portal/src/app/api/products/[id]/route.ts` (GET, PUT)
- ✅ `shop-portal/src/app/api/products/[id]/sync/route.ts`

### ⏳ Remaining API Routes (66 files):
All files in `shop-portal/src/app/api/` that still use `createServerClient` with default env vars.

**Pattern to replace:**
```typescript
// OLD
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey!,
  { cookies: { ... } }
)

// NEW
import { getTenantSupabase } from '@/lib/tenant-supabase'

const supabase = await getTenantSupabase()
```

## Phase 4: Server Libraries ⏳ PENDING
- ⏳ `shop-portal/src/lib/categories-server.ts` (6 instances)
- ⏳ `shop-portal/src/lib/competitors-server.ts`
- ⏳ `shop-portal/src/lib/ai-generation-service.ts`
- ⏳ `shop-portal/src/lib/product-quality-service.ts`
- ⏳ Server actions in `shop-portal/src/app/(dashboard)/*/actions.ts`

## Notes
- Subscription API routes (`/api/subscription/*`) already have tenant-aware logic with fallbacks
- Middleware is already tenant-aware
- Some files may have multiple Supabase client instances (helper functions, etc.) - all need updating
