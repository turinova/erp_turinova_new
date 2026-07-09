import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import type { Trade } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  COST_ITEM_XLSX_COLUMNS,
  costItemToExportRow,
} from "@/lib/cost-items/cost-items-xlsx"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgUnits,
} from "@/lib/cost-items/cost-items-repository"

export async function GET(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const tradeFilter = searchParams.get("trade") as Trade | null

  try {
    const [items, categories, units] = await Promise.all([
      fetchOrgCostItems(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
    ])

    const filtered = tradeFilter ? items.filter((i) => i.trade === tradeFilter) : items
    const exportRows = filtered.map((item) => costItemToExportRow(item, categories, units))

    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(exportRows, { header: [...COST_ITEM_XLSX_COLUMNS] })
    XLSX.utils.book_append_sheet(wb, sheet, "Tetelek")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const timestamp = new Date().toISOString().split("T")[0]
    const suffix = tradeFilter ? `_${tradeFilter}` : ""

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tetelek_export${suffix}_${timestamp}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("cost-items export:", error)
    return NextResponse.json({ error: "Export hiba." }, { status: 500 })
  }
}
