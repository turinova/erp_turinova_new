const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for optimized operations')
}

// Create a mock Supabase client for build time
const createMockSupabaseClient = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        is: () => ({
          single: () => ({ data: null, error: null })
        }),
        order: () => ({ data: [], error: null })
      }),
      is: () => ({
        order: () => ({ data: [], error: null })
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: null, error: null })
        })
      }),
      update: () => ({
        eq: () => ({
          is: () => ({
            select: () => ({
              single: () => ({ data: null, error: null })
            })
          })
        })
      }),
      ilike: () => ({
        is: () => ({
          limit: () => ({ data: [], error: null })
        })
      }),
      range: () => ({ data: [], error: null })
    })
  })
})

// Only import and use createClient if Supabase is configured
let supabaseOptimized: any
if (isSupabaseConfigured) {
  try {
    const { createClient } = require('@supabase/supabase-js')
    supabaseOptimized = createClient(supabaseUrl!, supabaseServiceKey!, {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Client-Info': 'nextjs-optimized',
        },
      },
      realtime: {
        enabled: false, // Disable realtime for better performance
      },
    })
  } catch (error) {
    console.warn('Failed to create optimized Supabase client, using mock:', error)
    supabaseOptimized = createMockSupabaseClient()
  }
} else {
  supabaseOptimized = createMockSupabaseClient()
}

// Export the optimized client
export { supabaseOptimized }

// Optimized query builder with common patterns
export class OptimizedQueryBuilder {
  private supabase = supabaseOptimized

  // Get all active records with optimized query
  async getAllActive<T>(
    tableName: string,
    columns: string = '*',
    orderBy: string = 'name',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(tableName)
      .select(columns)
      .is('deleted_at', null)
      .order(orderBy, { ascending: orderDirection === 'asc' })

    if (error) {
      console.error(`Error fetching ${tableName}:`, error)
      throw error
    }

    return data || []
  }

  // Get single record by ID with optimized query
  async getById<T>(
    tableName: string,
    id: string,
    columns: string = '*'
  ): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(tableName)
      .select(columns)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error(`Error fetching ${tableName} by ID:`, error)
      
return null
    }

    return data
  }

  // Create record with optimized insert
  async create<T>(
    tableName: string,
    data: Partial<T>
  ): Promise<T | null> {
    const { data: result, error } = await this.supabase
      .from(tableName)
      .insert(data)
      .select()
      .single()

    if (error) {
      console.error(`Error creating ${tableName}:`, error)
      throw error
    }

    return result
  }

  // Update record with optimized update
  async update<T>(
    tableName: string,
    id: string,
    data: Partial<T>
  ): Promise<T | null> {
    const { data: result, error } = await this.supabase
      .from(tableName)
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error(`Error updating ${tableName}:`, error)
      throw error
    }

    return result
  }

  // Soft delete record
  async softDelete(
    tableName: string,
    id: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from(tableName)
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error(`Error soft deleting ${tableName}:`, error)
      
return false
    }

    return true
  }

  // Search records with optimized query
  async search<T>(
    tableName: string,
    searchColumn: string,
    searchTerm: string,
    columns: string = '*',
    limit: number = 50
  ): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(tableName)
      .select(columns)
      .ilike(searchColumn, `%${searchTerm}%`)
      .is('deleted_at', null)
      .limit(limit)

    if (error) {
      console.error(`Error searching ${tableName}:`, error)
      
return []
    }

    return data || []
  }

  // Get paginated records
  async getPaginated<T>(
    tableName: string,
    page: number = 1,
    pageSize: number = 50,
    columns: string = '*',
    orderBy: string = 'name',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    const offset = (page - 1) * pageSize

    // Get total count
    const { count, error: countError } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (countError) {
      console.error(`Error getting count for ${tableName}:`, countError)
      throw countError
    }

    // Get paginated data
    const { data, error } = await this.supabase
      .from(tableName)
      .select(columns)
      .is('deleted_at', null)
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error(`Error getting paginated ${tableName}:`, error)
      throw error
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize
    }
  }
}

// Export singleton instance
export const optimizedQuery = new OptimizedQueryBuilder()

// Performance monitoring utilities
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map()

  static startTimer(label: string): void {
    this.timers.set(label, performance.now())
  }

  static endTimer(label: string): number {
    const startTime = this.timers.get(label)

    if (!startTime) {
      console.warn(`Timer ${label} was not started`)
      
return 0
    }

    const duration = performance.now() - startTime

    this.timers.delete(label)
    
    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`Slow query detected: ${label} took ${duration.toFixed(2)}ms`)
    }

    return duration
  }

  static async measureQuery<T>(
    label: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    this.startTimer(label)

    try {
      const result = await queryFn()
      const duration = this.endTimer(label)

      console.log(`Query ${label} completed in ${duration.toFixed(2)}ms`)
      
return result
    } catch (error) {
      this.endTimer(label)
      throw error
    }
  }
}

// Connection pool configuration
export const connectionConfig = {
  // Supabase connection pool settings
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },

  // Query timeout settings
  query: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
  }
}
