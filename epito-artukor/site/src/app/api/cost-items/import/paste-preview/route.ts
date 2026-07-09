import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  classifyPasteItems,
  isClassifyAiAvailable,
} from "@/lib/cost-items/classify-cost-item.server"
import { parsePasteImportText } from "@/lib/cost-items/parse-paste-import"
import {
  classifiedToPastePreviewRows,
  type PastePreviewRow,
} from "@/lib/cost-items/paste-import"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgUnits,
} from "@/lib/cost-items/cost-items-repository"
import { mapTradeRow, TRADE_SELECT, type TradeRow } from "@/lib/trades/trade-map"
import type { Category, Unit } from "@/types"
import type { TradeRecord } from "@/types/trade"

async function fetchOrgTradeRecords(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(TRADE_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return ((data ?? []) as TradeRow[]).map(mapTradeRow)
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const body = (await request.json()) as { text?: string }
    const text = body.text?.trim() ?? ""

    if (!text) {
      return NextResponse.json({ error: "Illeszd be legalább egy tétel nevét." }, { status: 400 })
    }

    const lines = parsePasteImportText(text)
    if (!lines.length) {
      return NextResponse.json({ error: "Nem található importálható sor." }, { status: 400 })
    }

    if (lines.length > 200) {
      return NextResponse.json(
        { error: "Egyszerre legfeljebb 200 tétel importálható." },
        { status: 400 }
      )
    }

    const [trades, categories, units, existingItems] = await Promise.all([
      fetchOrgTradeRecords(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
      fetchOrgCostItems(session.supabase, session.organization.id),
    ])

    const classified = await classifyPasteItems(lines, {
      trades,
      categories,
      units,
      existingItems,
    })

    const rows = classifiedToPastePreviewRows(classified, trades, categories, units)

    return NextResponse.json({
      rows,
      trades: trades.map((t) => ({ id: t.id, code: t.code, name: t.name })),
      categories,
      units,
      existingIdentifiers: existingItems.map((item) => ({
        identifier: item.identifier,
        categoryId: item.categoryId,
      })),
      aiAvailable: isClassifyAiAvailable(),
      aiUsedCount: rows.filter((r) => r.aiUsed).length,
      row_count: rows.length,
      error_count: rows.filter((r) => r.errors.length > 0).length,
      warning_count: rows.reduce((sum, r) => sum + r.warnings.length, 0),
    } satisfies {
      rows: PastePreviewRow[]
      trades: Array<{ id: string; code: string; name: string }>
      categories: Category[]
      units: Unit[]
      existingIdentifiers: Array<{ identifier: string; categoryId: string }>
      aiAvailable: boolean
      aiUsedCount: number
      row_count: number
      error_count: number
      warning_count: number
    })
  } catch (error) {
    console.error("cost-items paste-preview:", error)
    return NextResponse.json({ error: "Előnézet generálása sikertelen." }, { status: 500 })
  }
}
