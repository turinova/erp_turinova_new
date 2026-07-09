"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import type { Subcontractor, SubcontractorContact, SubcontractorInput } from "@/types/subcontractors"
import {
  buildSubcontractorActivity,
  getSubcontractorStats,
  listSubmissionRowsForSubcontractor,
} from "@/lib/subcontractor-queries"
import {
  fetchSubcontractorFromApi,
  saveSubcontractorToApi,
} from "@/lib/subcontractors/subcontractors-api-client"
import { subcontractorToInput } from "@/lib/subcontractors/subcontractor-input"
import { SubcontractorDetailHeader } from "@/components/alvalalkozok/subcontractor-detail-header"
import { SubcontractorFormDialog } from "@/components/alvalalkozok/subcontractor-form-dialog"
import { SubcontractorOverviewTab } from "@/components/alvalalkozok/subcontractor-overview-tab"
import { SubcontractorDetailsTab } from "@/components/alvalalkozok/subcontractor-details-tab"
import { SubmissionsHistoryTable } from "@/components/alvalalkozok/submissions-history-table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useProjectsBundleReady } from "@/hooks/use-projects-bundle-ready"

type Tab = "overview" | "submissions" | "details"

type SubcontractorDetailClientProps = {
  subcontractorId: string
}

export function SubcontractorDetailClient({ subcontractorId }: SubcontractorDetailClientProps) {
  const bundleReady = useProjectsBundleReady()
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<Subcontractor | null>(null)
  const [tab, setTab] = useState<Tab>("overview")
  const [editOpen, setEditOpen] = useState(false)

  const loadFromApi = useCallback(async () => {
    const { subcontractor, error } = await fetchSubcontractorFromApi(subcontractorId)
    if (error) toast.error(error)
    setSub(subcontractor ?? null)
    setLoading(false)
  }, [subcontractorId])

  useEffect(() => {
    void loadFromApi()
  }, [loadFromApi])

  const stats = useMemo(() => (sub ? getSubcontractorStats(sub) : null), [sub])

  const submissions = useMemo(
    () => (sub ? listSubmissionRowsForSubcontractor(sub) : []),
    [sub]
  )

  const activity = useMemo(() => (sub ? buildSubcontractorActivity(sub) : []), [sub])

  const persist = async (input: SubcontractorInput, id: string) => {
    const { subcontractor, error } = await saveSubcontractorToApi(input, id)
    if (error) {
      toast.error(error)
      throw new Error(error)
    }
    if (subcontractor) setSub(subcontractor)
    else await loadFromApi()
  }

  const handleSave = async (input: SubcontractorInput) => {
    if (!sub) return
    await persist(input, sub.id)
    toast.success("Partner mentve")
  }

  const saveNotes = async (notes: string) => {
    if (!sub || notes === sub.internalNotes) return
    await persist({ ...subcontractorToInput(sub), internalNotes: notes }, sub.id)
  }

  const handleSaveContacts = async (contacts: SubcontractorContact[]) => {
    if (!sub) return
    await persist({ ...subcontractorToInput(sub), contacts }, sub.id)
    toast.success("Kapcsolattartók mentve")
  }

  const handleAddReference = async (ref: {
    title: string
    projectName: string
    description: string
  }) => {
    if (!sub) return
    if (!ref.title.trim()) {
      toast.error("Add meg a referencia címét")
      return
    }

    const nextRef = {
      id: `ref-${Date.now()}`,
      sortOrder: sub.references.length + 1,
      title: ref.title.trim(),
      projectName: ref.projectName.trim() || undefined,
      trade: sub.trades[0],
      description: ref.description.trim() || undefined,
    }

    await persist(
      {
        ...subcontractorToInput(sub),
        references: [...sub.references, nextRef],
      },
      sub.id
    )

    toast.success("Referencia hozzáadva")
  }

  if (loading || !bundleReady) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  if (!sub || !stats) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-base text-slate-600">A partner nem található.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/alvalalkozok">Vissza a listához</Link>
        </Button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Áttekintés" },
    { id: "submissions", label: "Ajánlatok", count: submissions.length },
    { id: "details", label: "Részletek" },
  ]

  return (
    <>
      <SubcontractorDetailHeader sub={sub} onEdit={() => setEditOpen(true)} />

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
        <SubcontractorOverviewTab
          sub={sub}
          stats={stats}
          activity={activity}
          onViewAllReferences={() => setTab("details")}
        />
      ) : null}

      {tab === "submissions" ? (
        <SubmissionsHistoryTable rows={submissions} />
      ) : null}

      {tab === "details" ? (
        <SubcontractorDetailsTab
          sub={sub}
          onSaveNotes={saveNotes}
          onSaveContacts={handleSaveContacts}
          onAddReference={handleAddReference}
        />
      ) : null}

      <SubcontractorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={sub}
        onSave={handleSave}
      />
    </>
  )
}
