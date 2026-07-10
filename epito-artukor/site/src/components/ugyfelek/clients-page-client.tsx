"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"
import type { Client, ClientInput } from "@/types/clients"
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from "@/lib/client-labels"
import type { ClientProjectCounts } from "@/types/list-stats"
import { fetchClientsFromApi, saveClientToApi } from "@/lib/clients/clients-api-client"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClientFormDialog } from "@/components/ugyfelek/client-form-dialog"
import { ClientStatusBadge, ClientTypeBadge } from "@/components/ugyfelek/client-badges"

export function ClientsPageClient() {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [projectCounts, setProjectCounts] = useState<ClientProjectCounts>({
    byClientId: {},
    byClientName: {},
  })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<Client["status"] | "all">("all")
  const [clientType, setClientType] = useState<Client["clientType"] | "all">("all")
  const [createOpen, setCreateOpen] = useState(false)

  const fetchFromApi = useCallback(async () => {
    const [clientsRes, countsRes] = await Promise.all([
      fetchClientsFromApi(),
      fetch("/api/clients/project-counts").then(
        (r) => r.json() as Promise<ClientProjectCounts>
      ),
    ])
    if (clientsRes.error) toast.error(clientsRes.error)
    setClients(clientsRes.clients)
    if (countsRes?.byClientId) setProjectCounts(countsRes)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchFromApi()
  }, [fetchFromApi])

  const rows = useMemo(() => {
    let list = [...clients]
    if (status !== "all") list = list.filter((c) => c.status === status)
    if (clientType !== "all") list = list.filter((c) => c.clientType === clientType)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.legalName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.taxNumber?.includes(q)
      )
    }
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName, "hu"))
  }, [clients, search, status, clientType])

  const handleCreate = async (input: ClientInput) => {
    const { client, error } = await saveClientToApi(input)
    if (error) {
      toast.error(error)
      throw new Error(error)
    }
    toast.success("Új ügyfél létrehozva")
    if (client) {
      setClients((prev) => [...prev, client])
    } else {
      await fetchFromApi()
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Ügyfelek"
        description="Ügyfél törzs — magán és céges partnerek, projektek és ajánlatok összesítése"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Új ügyfél
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Keresés név, kód, email, adószám…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={clientType} onValueChange={(v) => setClientType(v as Client["clientType"] | "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Típus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden típus</SelectItem>
            {(Object.keys(CLIENT_TYPE_LABELS) as Client["clientType"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {CLIENT_TYPE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as Client["status"] | "all")}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Státusz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden státusz</SelectItem>
            {(Object.keys(CLIENT_STATUS_LABELS) as Client["status"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {CLIENT_STATUS_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="ea-table-head">
              <tr>
                <th className="px-4 py-2.5 text-left">Ügyfél</th>
                <th className="px-4 py-2.5 text-left">Kód</th>
                <th className="px-4 py-2.5 text-left">Típus</th>
                <th className="px-4 py-2.5 text-left">Elérhetőség</th>
                <th className="px-4 py-2.5 text-left">Projektek</th>
                <th className="px-4 py-2.5 text-left">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-base text-slate-500">
                    Nincs találat.{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setCreateOpen(true)}
                    >
                      Új ügyfél felvétele
                    </button>
                  </td>
                </tr>
              ) : (
                rows.map((client) => (
                  <ClientListRow key={client.id} client={client} projectCounts={projectCounts} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
    </>
  )
}

function ClientListRow({
  client,
  projectCounts,
}: {
  client: Client
  projectCounts: ClientProjectCounts
}) {
  const projectCount =
    projectCounts.byClientId[client.id] ??
    projectCounts.byClientName[client.displayName.trim().toLowerCase()] ??
    projectCounts.byClientName[client.legalName.trim().toLowerCase()] ??
    0

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link
          href={`/ugyfelek/${client.code || client.id}`}
          className="block hover:underline"
        >
          <p className="font-medium text-slate-900">{client.displayName}</p>
          <p className="truncate text-sm text-slate-500">{client.legalName}</p>
        </Link>
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
          {client.code}
        </code>
      </td>
      <td className="px-4 py-3">
        <ClientTypeBadge type={client.clientType} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {client.email ? <p>{client.email}</p> : null}
        {client.phone ? <p>{client.phone}</p> : null}
        {!client.email && !client.phone ? "—" : null}
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-700">{projectCount}</td>
      <td className="px-4 py-3">
        <ClientStatusBadge status={client.status} />
      </td>
    </tr>
  )
}
