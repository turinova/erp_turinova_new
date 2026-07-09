import type { Subcontractor, SubcontractorInput } from "@/types/subcontractors"

export async function fetchSubcontractorsFromApi(): Promise<{
  subcontractors: Subcontractor[]
  error?: string
}> {
  const res = await fetch("/api/subcontractors")
  const data = (await res.json()) as { subcontractors?: Subcontractor[]; error?: string }
  if (!res.ok) {
    return { subcontractors: [], error: data.error ?? "Nem sikerült betölteni a partnereket." }
  }
  return { subcontractors: data.subcontractors ?? [] }
}

export async function fetchSubcontractorFromApi(
  idOrCode: string
): Promise<{ subcontractor?: Subcontractor; error?: string }> {
  const res = await fetch(`/api/subcontractors/${encodeURIComponent(idOrCode)}`)
  const data = (await res.json()) as { subcontractor?: Subcontractor; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "A partner nem található." }
  }
  return { subcontractor: data.subcontractor }
}

export async function saveSubcontractorToApi(
  input: SubcontractorInput,
  id?: string
): Promise<{ subcontractor?: Subcontractor; error?: string }> {
  const isUpdate = Boolean(id)
  const res = await fetch(isUpdate ? `/api/subcontractors/${id}` : "/api/subcontractors", {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { subcontractor?: Subcontractor; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Mentés sikertelen." }
  }
  return { subcontractor: data.subcontractor }
}

export async function deleteSubcontractorFromApi(id: string): Promise<{ error?: string }> {
  const res = await fetch(`/api/subcontractors/${id}`, { method: "DELETE" })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Törlés sikertelen." }
  }
  return {}
}
