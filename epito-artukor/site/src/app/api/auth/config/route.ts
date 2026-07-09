import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export async function GET() {
  return NextResponse.json({
    mode: isSupabaseConfigured() ? "supabase" : "mock",
  })
}
