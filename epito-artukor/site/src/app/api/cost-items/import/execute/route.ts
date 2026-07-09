import { NextResponse } from "next/server"
import type { CostItemInput } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  costItemInputToInsertRow,
  costItemInputToUpdateRow,
  COST_ITEM_SELECT,
  mapCostItemRow,
  type CostItemRow,
} from "@/lib/cost-items/cost-item-map"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgTrades,
} from "@/lib/cost-items/cost-items-repository"
import { resolveCostItemFields } from "@/lib/cost-items/resolve-identifier.server"
import type { CostItemImportRow } from "@/lib/cost-items/cost-items-xlsx"

type ExecutePayload = {
  mode?: "upsert" | "create_only"
  rows: CostItemImportRow[]
}

type FailedRow = {
  rowNumber: number
  tetelszam: string | null
  reason: string
}

const CHUNK_SIZE = 50

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as ExecutePayload
  const rows = Array.isArray(body?.rows) ? body.rows : []
  const mode = body.mode === "create_only" ? "create_only" : "upsert"

  if (!rows.length) {
    return NextResponse.json({ error: "Nincs importálható sor." }, { status: 400 })
  }

  const importable = rows.filter((row) => row.action !== "SKIP" && row.errors.length === 0)

  if (!importable.length) {
    return NextResponse.json({ error: "Minden sor hibás vagy kihagyandó." }, { status: 400 })
  }

  try {
    let existing = await fetchOrgCostItems(session.supabase, session.organization.id)
    const categories = await fetchOrgCategories(session.supabase, session.organization.id)
    const trades = await fetchOrgTrades(session.supabase, session.organization.id)
    const tradeCodeById = new Map(trades.map((t) => [t.id, t.code]))

    const summary = {
      created: 0,
      updated: 0,
      skipped: rows.length - importable.length,
      failed: 0,
    }
    const failedRows: FailedRow[] = []

    for (let i = 0; i < importable.length; i += CHUNK_SIZE) {
      const chunk = importable.slice(i, i + CHUNK_SIZE)

      for (const row of chunk) {
        const tradeId = row.resolved.tradeId
        const categoryId = row.resolved.categoryId
        const unitId = row.resolved.unitId
        const tradeCode = tradeId ? tradeCodeById.get(tradeId) : undefined

        if (!tradeId || !categoryId || !unitId || !tradeCode) {
          summary.failed += 1
          failedRows.push({
            rowNumber: row.rowNumber,
            tetelszam: row.values.tetelszam || null,
            reason: "Hiányzó FK feloldás (szakág, kategória vagy ME).",
          })
          continue
        }

        const input: CostItemInput = {
          id: row.resolved.existingItemId ?? undefined,
          trade: tradeCode,
          identifier: row.normalized.identifier ?? "",
          isCustomItem: row.normalized.isCustomItem,
          text: row.normalized.text ?? "",
          shortLabel: null,
          categoryId,
          unitId,
          status: row.normalized.status,
          tags: row.normalized.tags,
          materialUnitPrice: row.normalized.materialUnitPrice,
          laborUnitPrice: row.normalized.laborUnitPrice,
        }

        const isUpdate = row.action === "UPDATE" && row.resolved.existingItemId

        if (isUpdate && mode === "create_only") {
          summary.skipped += 1
          continue
        }

        try {
          const resolved = resolveCostItemFields(
            input,
            existing,
            categories,
            !isUpdate
          )

          if (isUpdate && row.resolved.existingItemId) {
            const { data, error } = await session.supabase
              .from("cost_items")
              .update(costItemInputToUpdateRow(tradeId, { ...input, id: row.resolved.existingItemId }, resolved))
              .eq("id", row.resolved.existingItemId)
              .eq("organization_id", session.organization.id)
              .is("deleted_at", null)
              .select(COST_ITEM_SELECT)
              .single<CostItemRow>()

            if (error || !data) throw new Error(error?.message || "Frissítés sikertelen")

            const item = mapCostItemRow(data, tradeCode)
            existing = existing.map((e) => (e.id === item.id ? item : e))
            summary.updated += 1
          } else {
            const { data, error } = await session.supabase
              .from("cost_items")
              .insert(
                costItemInputToInsertRow(session.organization.id, tradeId, input, resolved)
              )
              .select(COST_ITEM_SELECT)
              .single<CostItemRow>()

            if (error || !data) throw new Error(error?.message || "Létrehozás sikertelen")

            const item = mapCostItemRow(data, tradeCode)
            existing = [item, ...existing]
            summary.created += 1
          }
        } catch (err) {
          summary.failed += 1
          failedRows.push({
            rowNumber: row.rowNumber,
            tetelszam: row.values.tetelszam || null,
            reason: err instanceof Error ? err.message : "Ismeretlen hiba",
          })
        }
      }
    }

    return NextResponse.json({
      summary,
      failedRows,
    })
  } catch (error) {
    console.error("cost-items import execute:", error)
    return NextResponse.json({ error: "Import futtatás sikertelen." }, { status: 500 })
  }
}
