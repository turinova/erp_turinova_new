"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"
import type { Subcontractor, SubcontractorInput } from "@/types/subcontractors"
import type { Trade } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import { useTradeOptions } from "@/components/trades/trades-provider"
import {
  SUBCONTRACTOR_STATUS_LABELS,
  SUBCONTRACTOR_TIER_LABELS,
} from "@/lib/subcontractor-labels"
import { getSubcontractorStats } from "@/lib/subcontractor-queries"
import {
  fetchSubcontractorsFromApi,
  saveSubcontractorToApi,
} from "@/lib/subcontractors/subcontractors-api-client"
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
import { SubcontractorAvatar } from "@/components/alvalalkozok/subcontractor-avatar"
import {
  SubcontractorStatusBadge,
  SubcontractorTierBadge,
} from "@/components/alvalalkozok/subcontractor-badges"
import { SubcontractorFormDialog } from "@/components/alvalalkozok/subcontractor-form-dialog"
import { useProjectsBundleReady } from "@/hooks/use-projects-bundle-ready"

function filterRows(
  items: Subcontractor[],
  filters: {
    q: string
    trade: Trade | "all"
    status: Subcontractor["status"] | "all"
    tier: Subcontractor["tier"] | "all"
  }
): Subcontractor[] {
  let rows = [...items]

  if (filters.trade !== "all") {
    rows = rows.filter((s) => s.trades.includes(filters.trade))
  }
  if (filters.status !== "all") {
    rows = rows.filter((s) => s.status === filters.status)
  }
  if (filters.tier !== "all") {
    rows = rows.filter((s) => s.tier === filters.tier)
  }
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.legalName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.taxNumber?.includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "hu"))
}

export function SubcontractorsPageClient() {
  const tradeOptions = useTradeOptions()
  const bundleReady = useProjectsBundleReady()
  const [loading, setLoading] = useState(true)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [search, setSearch] = useState("")
  const [trade, setTrade] = useState<Trade | "all">("all")
  const [status, setStatus] = useState<Subcontractor["status"] | "all">("all")
  const [tier, setTier] = useState<Subcontractor["tier"] | "all">("all")
  const [createOpen, setCreateOpen] = useState(false)

  const fetchFromApi = useCallback(async () => {
    const { subcontractors: rows, error } = await fetchSubcontractorsFromApi()
    if (error) toast.error(error)
    setSubcontractors(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchFromApi()
  }, [fetchFromApi])

  const rows = useMemo(
    () => filterRows(subcontractors, { q: search, trade, status, tier }),
    [subcontractors, search, trade, status, tier]
  )

  const handleCreate = async (input: SubcontractorInput) => {
    const { subcontractor, error } = await saveSubcontractorToApi(input)
    if (error) {
      toast.error(error)
      throw new Error(error)
    }
    toast.success("Új partner létrehozva")
    if (subcontractor) {
      setSubcontractors((prev) => [...prev, subcontractor])
    } else {
      await fetchFromApi()
    }
  }

  if (loading || !bundleReady) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Alvállalkozók"
        description="Partner törzs — elérhetőség, referenciák és beküldött RFQ ajánlatok"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Új alvállalkozó
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
        <Select value={trade} onValueChange={(v) => setTrade(v as Trade | "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Szakág" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden szakág</SelectItem>
            {tradeOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as Subcontractor["status"] | "all")}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Státusz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden státusz</SelectItem>
            {(Object.keys(SUBCONTRACTOR_STATUS_LABELS) as Subcontractor["status"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {SUBCONTRACTOR_STATUS_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={(v) => setTier(v as Subcontractor["tier"] | "all")}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden tier</SelectItem>
            {(Object.keys(SUBCONTRACTOR_TIER_LABELS) as Subcontractor["tier"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {SUBCONTRACTOR_TIER_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="ea-table-head">
              <tr>
                <th className="px-4 py-2.5 text-left">Partner</th>
                <th className="px-4 py-2.5 text-left">Kód</th>
                <th className="px-4 py-2.5 text-left">Szakág</th>
                <th className="px-4 py-2.5 text-left">Tier</th>
                <th className="px-4 py-2.5 text-left">Elérhetőség</th>
                <th className="px-4 py-2.5 text-left">RFQ</th>
                <th className="px-4 py-2.5 text-left">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-base text-slate-500">
                    Nincs találat.{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setCreateOpen(true)}
                    >
                      Új partner felvétele
                    </button>
                  </td>
                </tr>
              ) : (
                rows.map((sub) => <SubcontractorListRow key={sub.id} sub={sub} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SubcontractorFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingSubcontractors={subcontractors}
        onSave={handleCreate}
      />
    </>
  )
}

function SubcontractorListRow({ sub }: { sub: Subcontractor }) {
  const stats = useMemo(() => getSubcontractorStats(sub), [sub])

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link
          href={`/alvalalkozok/${sub.code || sub.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <SubcontractorAvatar name={sub.displayName} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{sub.displayName}</p>
            <p className="truncate text-sm text-slate-500">{sub.legalName}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
          {sub.code}
        </code>
      </td>
      <td className="px-4 py-3 text-base text-slate-700">
        {sub.trades.map((t) => getTradeLabel(t)).join(", ")}
      </td>
      <td className="px-4 py-3">
        <SubcontractorTierBadge tier={sub.tier} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {sub.email ? <p>{sub.email}</p> : null}
        {sub.phone ? <p>{sub.phone}</p> : null}
        {!sub.email && !sub.phone ? "—" : null}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        <span className="tabular-nums">{stats.submittedCount}</span> beküldés
        {stats.lastSubmissionAt ? (
          <p className="text-xs text-slate-400">
            Utolsó: {new Date(stats.lastSubmissionAt).toLocaleDateString("hu-HU")}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <SubcontractorStatusBadge status={sub.status} />
      </td>
    </tr>
  )
}
