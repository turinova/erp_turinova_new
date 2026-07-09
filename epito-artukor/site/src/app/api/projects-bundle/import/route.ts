import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { ProjectDataBundle } from "@/types/projects"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { normalizeProjectBundle } from "@/lib/quote-migration"
import { syncBundleToDb } from "@/lib/server/projects-bundle-db"

const LEGACY_FILE = path.join(process.cwd(), ".data", "projects-bundle.json")

/**
 * Egyszeri import: a legacy .data/projects-bundle.json (vagy a request body)
 * → Supabase. A legacy (nem-UUID) id-kat a sync réteg képezi át, a JSONB
 * snapshotok belsejében is. Idempotens: újrafuttatva a remap új id-kat
 * generál, ezért éles adatra csak EGYSZER futtasd üres projekt-táblákra.
 */
export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    let bundle: ProjectDataBundle | null = null

    const text = await request.text()
    if (text.trim()) {
      bundle = JSON.parse(text) as ProjectDataBundle
    } else if (existsSync(LEGACY_FILE)) {
      bundle = JSON.parse(readFileSync(LEGACY_FILE, "utf8")) as ProjectDataBundle
    }

    if (!bundle) {
      return NextResponse.json(
        { error: "Nincs importálható adat (.data/projects-bundle.json nem található, body üres)." },
        { status: 404 }
      )
    }

    const normalized = normalizeProjectBundle(bundle)
    await syncBundleToDb(session.supabase, session.organization.id, normalized)

    return NextResponse.json({
      ok: true,
      imported: {
        projects: normalized.projects.length,
        quotes: normalized.quotes.length,
        quoteLines: normalized.quoteLines.length,
        rfqs: normalized.rfqs.length,
        customerPackages: normalized.customerPackages.length,
        performanceCertificates: normalized.performanceCertificates?.length ?? 0,
      },
    })
  } catch (error) {
    console.error("projects-bundle import:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 }
    )
  }
}
