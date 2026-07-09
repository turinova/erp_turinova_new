"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, X } from "lucide-react"
import type { Trade } from "@/types"
import {
  getSubcontractor,
  listSubcontractorsForTrade,
  resolveSubcontractorInviteFields,
} from "@/lib/data/subcontractors-store"
import { Button } from "@/components/ui/button"
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
import { AlertTriangle } from "lucide-react"

export type RfqSubcontractorInvite = {
  subcontractorId: string
  name: string
  phone?: string
  email?: string
}

type RfqSubcontractorSelectListProps = {
  trade: Trade
  value: RfqSubcontractorInvite[]
  onChange: (next: RfqSubcontractorInvite[]) => void
  maxCount?: number
}

export function RfqSubcontractorSelectList({
  trade,
  value,
  onChange,
  maxCount = 5,
}: RfqSubcontractorSelectListProps) {
  const [pickKey, setPickKey] = useState(0)
  const available = listSubcontractorsForTrade(trade).filter(
    (s) => !value.some((v) => v.subcontractorId === s.id)
  )

  const addId = (id: string) => {
    if (id === "__none__") return
    const sub = getSubcontractor(id)
    if (!sub || value.some((v) => v.subcontractorId === id)) return
    onChange([...value, resolveSubcontractorInviteFields(sub)])
    setPickKey((k) => k + 1)
  }

  const remove = (id: string) => {
    onChange(value.filter((v) => v.subcontractorId !== id))
  }

  const hasBlocked = value.some(
    (v) => getSubcontractor(v.subcontractorId)?.status === "blocked"
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Csak a partner törzsből választhatsz — mindegyik külön linket kap.
        </p>
        <Link
          href="/alvalalkozok"
          className="text-xs text-blue-600 hover:underline"
          target="_blank"
        >
          Partner törzs
        </Link>
      </div>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Még nincs kiválasztott alvállalkozó.
        </div>
      ) : (
        <ul className="space-y-2">
          {value.map((inv) => {
            const sub = getSubcontractor(inv.subcontractorId)
            if (!sub) return null
            return (
              <li
                key={inv.subcontractorId}
                className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5"
              >
                <SubcontractorAvatar name={sub.displayName} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{sub.displayName}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[inv.phone, inv.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <SubcontractorTierBadge tier={sub.tier} />
                    <SubcontractorStatusBadge status={sub.status} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-slate-400 hover:text-slate-700"
                  onClick={() => remove(inv.subcontractorId)}
                  aria-label={`${sub.displayName} eltávolítása`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {hasBlocked ? (
        <p className="flex items-start gap-1.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Tiltott partner is szerepel a listán — meghívás saját felelősségre.
        </p>
      ) : null}

      {value.length < maxCount ? (
        <div className="flex gap-2">
          <Select key={pickKey} onValueChange={addId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Partner hozzáadása…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  Nincs több választható partner ezen a szakágon
                </SelectItem>
              ) : (
                available.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.displayName}
                    {sub.status === "blocked" ? " (tiltott)" : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            asChild
            className="shrink-0"
          >
            <Link href="/alvalalkozok" target="_blank">
              <Plus className="mr-1 h-4 w-4" />
              Új partner
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Maximum {maxCount} partner meghívható egyszerre.</p>
      )}
    </div>
  )
}
