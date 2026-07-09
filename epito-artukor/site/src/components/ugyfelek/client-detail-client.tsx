"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import type { Client, ClientContact, ClientInput } from "@/types/clients"
import { clientToInput } from "@/lib/data/clients-store"
import { getClientStats, listClientProjectRows } from "@/lib/client-queries"
import { fetchClientFromApi, saveClientToApi } from "@/lib/clients/clients-api-client"
import { ClientDetailHeader } from "@/components/ugyfelek/client-detail-header"
import { ClientOverviewTab } from "@/components/ugyfelek/client-overview-tab"
import { ClientProjectsTab } from "@/components/ugyfelek/client-projects-tab"
import { ClientDetailsTab } from "@/components/ugyfelek/client-details-tab"
import { ClientFormDialog } from "@/components/ugyfelek/client-form-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useProjectsBundleReady } from "@/hooks/use-projects-bundle-ready"

type Tab = "overview" | "projects" | "details"

type ClientDetailClientProps = {
  clientId: string
}

export function ClientDetailClient({ clientId }: ClientDetailClientProps) {
  const bundleReady = useProjectsBundleReady()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [tab, setTab] = useState<Tab>("overview")
  const [editOpen, setEditOpen] = useState(false)

  const loadFromApi = useCallback(async () => {
    const { client: row, error } = await fetchClientFromApi(clientId)
    if (error) toast.error(error)
    setClient(row ?? null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void loadFromApi()
  }, [loadFromApi])

  const stats = useMemo(() => (client ? getClientStats(client) : null), [client])
  const projectRows = useMemo(
    () => (client ? listClientProjectRows(client) : []),
    [client]
  )

  const persist = useCallback(
    async (input: ClientInput) => {
      if (!client) return
      const { client: updated, error } = await saveClientToApi(input, client.id)
      if (error) {
        toast.error(error)
        throw new Error(error)
      }
      if (updated) setClient(updated)
    },
    [client]
  )

  const handleSaveNotes = useCallback(
    async (notes: string) => {
      if (!client || notes === client.internalNotes) return
      await persist({ ...clientToInput(client), internalNotes: notes })
    },
    [client, persist]
  )

  const handleSaveContacts = useCallback(
    async (contacts: ClientContact[]) => {
      if (!client) return
      await persist({ ...clientToInput(client), contacts })
      toast.success("Kapcsolattartók mentve")
    },
    [client, persist]
  )

  const handleEdit = async (input: ClientInput) => {
    await persist(input)
    toast.success("Ügyfél mentve")
  }

  if (loading || !bundleReady) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  if (!client || !stats) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-base text-slate-600">Az ügyfél nem található.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/ugyfelek">Vissza a listához</Link>
        </Button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Áttekintés" },
    { id: "projects", label: "Projektek", count: projectRows.length },
    { id: "details", label: "Részletek" },
  ]

  return (
    <>
      <ClientDetailHeader client={client} onEdit={() => setEditOpen(true)} />

      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count != null && t.count > 0 ? (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums">
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <ClientOverviewTab
          client={client}
          stats={stats}
          onViewAllProjects={() => setTab("projects")}
        />
      ) : null}

      {tab === "projects" ? <ClientProjectsTab client={client} /> : null}

      {tab === "details" ? (
        <ClientDetailsTab
          client={client}
          onSaveNotes={handleSaveNotes}
          onSaveContacts={handleSaveContacts}
        />
      ) : null}

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={client}
        onSave={handleEdit}
      />
    </>
  )
}
