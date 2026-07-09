import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { buildQuoteImportPreview } from "@/lib/cost-items/build-quote-import-preview"
import {
  isQuoteImportAiAvailable,
  matchQuoteImportLines,
} from "@/lib/cost-items/match-quote-import.server"
import { parseQuoteImportText } from "@/lib/cost-items/parse-quote-import"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
} from "@/lib/cost-items/cost-items-repository"
import { loadBundleFromDb } from "@/lib/server/projects-bundle-db"
import type { Quote } from "@/types/projects"

type PreviewBody = {
  text?: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const { projectId } = await context.params
    const body = (await request.json()) as PreviewBody
    const text = body.text?.trim() ?? ""

    if (!text) {
      return NextResponse.json({ error: "Illeszd be legalább egy tétel nevét." }, { status: 400 })
    }

    const lines = parseQuoteImportText(text)
    if (!lines.length) {
      return NextResponse.json({ error: "Nem található importálható sor." }, { status: 400 })
    }

    if (lines.length > 200) {
      return NextResponse.json(
        { error: "Egyszerre legfeljebb 200 tétel importálható." },
        { status: 400 }
      )
    }

    const bundle = await loadBundleFromDb(session.supabase, session.organization.id)
    const project = bundle.projects.find((p) => p.id === projectId)
    if (!project) {
      return NextResponse.json({ error: "A projekt nem található." }, { status: 404 })
    }

    if (project.status === "archived" || project.status === "done") {
      return NextResponse.json(
        { error: "Lezárt vagy archivált projekthez nem importálható költségvetés." },
        { status: 400 }
      )
    }

    const [items, categories] = await Promise.all([
      fetchOrgCostItems(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
    ])

    const matched = await matchQuoteImportLines(lines, { items, categories })
    const projectQuotes = bundle.quotes.filter((q) => q.projectId === projectId) as Quote[]
    const preview = buildQuoteImportPreview(
      matched,
      projectQuotes,
      items,
      isQuoteImportAiAvailable()
    )

    return NextResponse.json(preview)
  } catch (error) {
    console.error("quote import preview:", error)
    return NextResponse.json({ error: "Import előnézet sikertelen." }, { status: 500 })
  }
}
