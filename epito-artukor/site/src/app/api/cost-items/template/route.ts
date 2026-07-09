import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  COST_ITEM_XLSX_COLUMNS,
  getCostItemInstructionRows,
  getCostItemTemplateRows,
} from "@/lib/cost-items/cost-items-xlsx"

function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const templateSheet = XLSX.utils.json_to_sheet(getCostItemTemplateRows(), {
    header: [...COST_ITEM_XLSX_COLUMNS],
  })
  const instructionsSheet = XLSX.utils.json_to_sheet(getCostItemInstructionRows())
  XLSX.utils.book_append_sheet(wb, templateSheet, "Tetelek")
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Utmutato")
  return wb
}

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const buffer = XLSX.write(buildTemplateWorkbook(), { type: "buffer", bookType: "xlsx" })
    const timestamp = new Date().toISOString().split("T")[0]

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tetelek_sablon_${timestamp}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("cost-items template:", error)
    return NextResponse.json({ error: "Sablon generálási hiba." }, { status: 500 })
  }
}
