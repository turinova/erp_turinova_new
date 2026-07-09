import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  enrichCostItemImportRows,
  normalizeCostItemImportRows,
  validateHeaderColumns,
  type CostItemImportRow,
} from "@/lib/cost-items/cost-items-xlsx"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgTrades,
  fetchOrgUnits,
} from "@/lib/cost-items/cost-items-repository"

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const modeParam = formData.get("mode")
    const mode = modeParam === "create_only" ? "create_only" : "upsert"

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fájl feltöltése kötelező." }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Csak .xlsx fájl tölthető fel." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return NextResponse.json({ error: "A fájl nem tartalmaz munkalapot." }, { status: 400 })
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "A fájl üres, nincs importálható sor." }, { status: 400 })
    }

    const headers = Object.keys(rawRows[0] || {})
    const headerErrors = validateHeaderColumns(headers)
    if (headerErrors.length > 0) {
      return NextResponse.json({ error: headerErrors.join(" | ") }, { status: 400 })
    }

    const [trades, categories, units, existingItems] = await Promise.all([
      fetchOrgTrades(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
      fetchOrgCostItems(session.supabase, session.organization.id),
    ])

    const existingByIdentifier = new Map(
      existingItems.map((item) => [item.identifier.toLowerCase(), item])
    )

    const normalized = normalizeCostItemImportRows(rawRows)
    const rows = enrichCostItemImportRows(
      normalized,
      { trades, categories, units, existingByIdentifier },
      mode
    )

    const errorCount = rows.reduce((sum, row) => sum + row.errors.length, 0)
    const warningCount = rows.reduce((sum, row) => sum + row.warnings.length, 0)
    const createCount = rows.filter((r) => r.action === "CREATE" && r.errors.length === 0).length
    const updateCount = rows.filter((r) => r.action === "UPDATE" && r.errors.length === 0).length
    const skipCount = rows.filter((r) => r.action === "SKIP").length

    return NextResponse.json({
      filename: file.name,
      mode,
      row_count: rows.length,
      error_count: errorCount,
      warning_count: warningCount,
      create_count: createCount,
      update_count: updateCount,
      skip_count: skipCount,
      rows: rows as CostItemImportRow[],
    })
  } catch (error) {
    console.error("cost-items import preview:", error)
    return NextResponse.json({ error: "Import előnézet sikertelen." }, { status: 500 })
  }
}
