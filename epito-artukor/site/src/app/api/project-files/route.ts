import { NextResponse } from "next/server"
import type { ProjectFile, ProjectFileFolderRecord } from "@/types/project-files"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  loadProjectFilesState,
  syncProjectFilesState,
} from "@/lib/server/project-files-db"

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response
  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const state = await loadProjectFilesState(session.supabase, session.organization.id)
    return NextResponse.json(state)
  } catch (error) {
    console.error("project-files GET:", error)
    return NextResponse.json({ error: "Hiba a fájlok betöltésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response
  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const body = (await request.json()) as {
      folders: ProjectFileFolderRecord[]
      files: ProjectFile[]
    }
    await syncProjectFilesState(session.supabase, session.organization.id, body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("project-files PUT:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 400 }
    )
  }
}
