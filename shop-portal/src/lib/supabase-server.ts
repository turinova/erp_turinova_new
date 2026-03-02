import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getTenantSupabase } from './tenant-supabase'

/**
 * Get Supabase Server Client
 * 
 * This function uses tenant-aware Supabase client.
 * It automatically gets the tenant context from session and connects to the tenant's database.
 * 
 * CRITICAL: No fallback to default database - this is a SaaS app where each tenant must use their own database.
 * If tenant context is not found, this will throw an error.
 */
export const supabaseServer = async () => {
  // Get tenant-aware Supabase client - NO FALLBACK
  // This ensures all operations are scoped to the logged-in user's tenant
  return await getTenantSupabase()
}
