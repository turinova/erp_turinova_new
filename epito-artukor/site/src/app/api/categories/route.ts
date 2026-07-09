import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  CATEGORY_SELECT,
  categoryInputToInsertRow,
  mapCategoryRow,
  type CategoryRow,
  type CategoryWriteInput,
} from "@/lib/categories/category-map"
import { validateCategoryInput } from "@/lib/categories/validate-category"
import type { Category } from "@/types"

async function fetchOrgTradeCodes(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("code")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (error) throw error
  return (data ?? []).map((row) => row.code as string)
}

async function fetchOrgCategories(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return ((data ?? []) as CategoryRow[]).map(mapCategoryRow)
}

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json(
      { error: "Supabase nincs beállítva — mock módban a kliens localStorage-t használ." },
      { status: 503 }
    )
  }

  try {
    const categories = await fetchOrgCategories(session.supabase, session.organization.id)
    return NextResponse.json({ categories })
  } catch (error) {
    console.error("categories GET:", error)
    return NextResponse.json(
      { error: "Hiba a kategóriák lekérdezésekor." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as CategoryWriteInput
  const parentId = body.parentId ?? null

  try {
    const existing = await fetchOrgCategories(session.supabase, session.organization.id)
    const tradeCodes = await fetchOrgTradeCodes(session.supabase, session.organization.id)
    const validation = validateCategoryInput(
      { ...body, parentId },
      existing,
      undefined,
      tradeCodes
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    if (parentId) {
      const { data: parent } = await session.supabase
        .from("categories")
        .select("id")
        .eq("id", parentId)
        .eq("organization_id", session.organization.id)
        .is("deleted_at", null)
        .maybeSingle()

      if (!parent) {
        return NextResponse.json({ error: "A szülő kategória nem található." }, { status: 400 })
      }
    }

    let sortQuery = session.supabase
      .from("categories")
      .select("sort_order")
      .eq("organization_id", session.organization.id)
      .is("deleted_at", null)

    if (parentId) {
      sortQuery = sortQuery.eq("parent_id", parentId)
    } else {
      sortQuery = sortQuery.is("parent_id", null)
    }

    const { data: maxSort } = await sortQuery
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const sortOrder = (maxSort?.sort_order ?? 0) + 1

    const { data, error } = await session.supabase
      .from("categories")
      .insert(
        categoryInputToInsertRow(session.organization.id, {
          ...body,
          parentId,
          sortOrder,
        })
      )
      .select(CATEGORY_SELECT)
      .single<CategoryRow>()

    if (error || !data) {
      console.error("categories POST:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a kategória létrehozásakor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ category: mapCategoryRow(data) }, { status: 201 })
  } catch (error) {
    console.error("categories POST:", error)
    return NextResponse.json({ error: "Hiba a kategória létrehozásakor." }, { status: 500 })
  }
}
