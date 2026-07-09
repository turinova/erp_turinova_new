import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fileToRow, mapFileRow } from "@/lib/server/project-files-db"
import type { ProjectFile, ProjectFileCategory } from "@/types/project-files"

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Fájl feltöltése: Supabase Storage (project-files bucket) + metaadat-sor. */
export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response
  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Hiányzó fájl." }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Maximális méret: 15 MB" }, { status: 400 })
    }

    const projectId = String(form.get("projectId") ?? "")
    const folderId = String(form.get("folderId") ?? "")
    if (!projectId || !folderId) {
      return NextResponse.json({ error: "Hiányzó projekt vagy mappa." }, { status: 400 })
    }

    const orgId = session.organization.id
    const id = crypto.randomUUID()
    const storagePath = `${orgId}/${projectId}/${id}`

    const { error: uploadError } = await session.supabase.storage
      .from("project-files")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })
    if (uploadError) {
      console.error("storage upload:", uploadError)
      return NextResponse.json({ error: "A fájl feltöltése sikertelen." }, { status: 500 })
    }

    const category = (String(form.get("category") ?? "other") || "other") as ProjectFileCategory
    const row: ProjectFile = {
      id,
      projectId,
      orgId,
      folderId,
      category,
      title: String(form.get("title") ?? "").trim() || file.name,
      description: String(form.get("description") ?? "").trim() || undefined,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageKey: `storage:${storagePath}`,
      takenAt: String(form.get("takenAt") ?? "") || undefined,
      quoteId: String(form.get("quoteId") ?? "") || undefined,
      uploadedAt: new Date().toISOString(),
      sortOrder: Number(form.get("sortOrder") ?? 1),
    }

    const { data, error } = await session.supabase
      .from("project_files")
      .insert(fileToRow(row, orgId))
      .select("*")
      .single()
    if (error || !data) {
      await session.supabase.storage.from("project-files").remove([storagePath])
      console.error("project_files insert:", error)
      return NextResponse.json({ error: "A fájl mentése sikertelen." }, { status: 500 })
    }

    return NextResponse.json({ file: mapFileRow(data) }, { status: 201 })
  } catch (error) {
    console.error("project-files upload:", error)
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 })
  }
}
