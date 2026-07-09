import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  CATEGORY_SELECT,
  categoryInputToUpdateRow,
  mapCategoryRow,
  type CategoryRow,
  type CategoryWriteInput,
} from "@/lib/categories/category-map"
import { collectDescendantIds } from "@/lib/categories/category-tree"
import { validateCategoryInput } from "@/lib/categories/validate-category"
import type { Category } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

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

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params
  const body = (await request.json()) as CategoryWriteInput
  const parentId = body.parentId ?? null

  try {
    const existing = await fetchOrgCategories(session.supabase, session.organization.id)
    const tradeCodes = await fetchOrgTradeCodes(session.supabase, session.organization.id)
    const current = existing.find((c) => c.id === id)
    if (!current) {
      return NextResponse.json({ error: "A kategória nem található." }, { status: 404 })
    }

    const validation = validateCategoryInput(
      { ...body, parentId, sortOrder: current.sortOrder },
      existing,
      id,
      tradeCodes
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data, error } = await session.supabase
      .from("categories")
      .update(
        categoryInputToUpdateRow({
          ...body,
          parentId,
          sortOrder: current.sortOrder,
        })
      )
      .eq("id", id)
      .eq("organization_id", session.organization.id)
      .select(CATEGORY_SELECT)
      .single<CategoryRow>()

    if (error || !data) {
      console.error("categories PUT:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a kategória mentésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ category: mapCategoryRow(data) })
  } catch (error) {
    console.error("categories PUT:", error)
    return NextResponse.json({ error: "Hiba a kategória mentésekor." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const existing = await fetchOrgCategories(session.supabase, session.organization.id)
    const current = existing.find((c) => c.id === id)
    if (!current) {
      return NextResponse.json({ error: "A kategória nem található." }, { status: 404 })
    }

    const idsToDelete = [id, ...collectDescendantIds(id, existing)]
    const deletedAt = new Date().toISOString()

    const { error } = await session.supabase
      .from("categories")
      .update({ deleted_at: deletedAt })
      .eq("organization_id", session.organization.id)
      .in("id", idsToDelete)

    if (error) {
      console.error("categories DELETE:", error)
      return NextResponse.json(
        { error: error.message || "Hiba a kategória törlésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deletedCount: idsToDelete.length })
  } catch (error) {
    console.error("categories DELETE:", error)
    return NextResponse.json({ error: "Hiba a kategória törlésekor." }, { status: 500 })
  }
}
