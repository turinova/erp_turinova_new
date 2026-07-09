import type { Client, ClientInput } from "@/types/clients"

export async function fetchClientsFromApi(): Promise<{
  clients: Client[]
  error?: string
}> {
  const res = await fetch("/api/clients")
  const data = (await res.json()) as { clients?: Client[]; error?: string }
  if (!res.ok) {
    return { clients: [], error: data.error ?? "Nem sikerült betölteni az ügyfeleket." }
  }
  return { clients: data.clients ?? [] }
}

export async function fetchClientFromApi(
  idOrCode: string
): Promise<{ client?: Client; error?: string }> {
  const res = await fetch(`/api/clients/${encodeURIComponent(idOrCode)}`)
  const data = (await res.json()) as { client?: Client; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Az ügyfél nem található." }
  }
  return { client: data.client }
}

export async function saveClientToApi(
  input: ClientInput,
  id?: string
): Promise<{ client?: Client; error?: string }> {
  const isUpdate = Boolean(id)
  const res = await fetch(isUpdate ? `/api/clients/${id}` : "/api/clients", {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { client?: Client; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Mentés sikertelen." }
  }
  return { client: data.client }
}

export async function deleteClientFromApi(id: string): Promise<{ error?: string }> {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Törlés sikertelen." }
  }
  return {}
}
