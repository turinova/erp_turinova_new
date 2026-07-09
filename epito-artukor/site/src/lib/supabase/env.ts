function getSupabaseKeyFromEnv(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  )
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && getSupabaseKeyFromEnv())
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error("Hiányzik a NEXT_PUBLIC_SUPABASE_URL (.env.local)")
  }
  return url
}

export function getSupabaseAnonKey(): string {
  const key = getSupabaseKeyFromEnv()
  if (!key) {
    throw new Error(
      "Hiányzik a NEXT_PUBLIC_SUPABASE_ANON_KEY vagy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)"
    )
  }
  return key
}
