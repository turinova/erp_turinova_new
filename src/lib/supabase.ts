import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
