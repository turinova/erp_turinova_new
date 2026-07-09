import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"

type RouteParams = { params: Promise<{ id: string }> }

/** Aláírt letöltési URL a privát Storage buckethez. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireApiSession()
  if (!session.ok) return session.response
  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await params
  const { data: row } = await session.supabase
    .from("project_files")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle<{ storage_key: string }>()
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (row.storage_key.startsWith("url:")) {
    return NextResponse.json({ url: row.storage_key.slice(4) })
  }
  if (!row.storage_key.startsWith("storage:")) {
    return NextResponse.json({ error: "A fájl tartalma nem érhető el." }, { status: 410 })
  }

  const path = row.storage_key.slice("storage:".length)
  const { data, error } = await session.supabase.storage
    .from("project-files")
    .createSignedUrl(path, 60 * 10)
  if (error || !data) {
    console.error("signed url:", error)
    return NextResponse.json({ error: "Nem sikerült linket készíteni." }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}

/** Fájl törlése — Storage objektum + metaadat-sor. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireApiSession()
  if (!session.ok) return session.response
  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await params
  const { data: row } = await session.supabase
    .from("project_files")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle<{ storage_key: string }>()
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (row.storage_key.startsWith("storage:")) {
    await session.supabase.storage
      .from("project-files")
      .remove([row.storage_key.slice("storage:".length)])
  }

  const { error } = await session.supabase.from("project_files").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Törlés sikertelen." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
