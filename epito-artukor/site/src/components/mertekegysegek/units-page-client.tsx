"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Unit } from "@/types"
import { setUnitsCache } from "@/lib/data/units-store"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function UnitsPageClient() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm] = useState({ code: "", name: "" })

  const fetchUnitsFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/units")
      const data = (await res.json()) as { units?: Unit[]; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Nem sikerült betölteni a mértékegységeket.")
        setUnits([])
        return
      }
      setUnits(data.units ?? [])
      setUnitsCache(data.units ?? [])
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
      setUnits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUnitsFromApi()
  }, [fetchUnitsFromApi])

  const openNew = () => {
    setEditing(null)
    setForm({ code: "", name: "" })
    setDrawerOpen(true)
  }

  const openEdit = (unit: Unit) => {
    setEditing(unit)
    setForm({ code: unit.code, name: unit.name })
    setDrawerOpen(true)
  }

  const validateForm = (): boolean => {
    const code = form.code.trim()
    const name = form.name.trim()
    if (!code || !name) {
      toast.error("A kód és a név megadása kötelező.")
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    const payload = { code: form.code.trim(), name: form.name.trim() }

    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/units/${editing.id}` : "/api/units", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { unit?: Unit; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Mentés sikertelen.")
        return
      }
      setDrawerOpen(false)
      toast.success(editing ? "Mértékegység mentve" : "Új mértékegység létrehozva")
      await fetchUnitsFromApi()
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`„${unit.code}” (${unit.name}) törlése?`)) return

    setSaving(true)
    try {
      const res = await fetch(`/api/units/${unit.id}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Törlés sikertelen.")
        return
      }
      toast.success("Mértékegység törölve")
      await fetchUnitsFromApi()
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Mértékegységek"
        description={`${units.length} mértékegység`}
        actions={
          <Button size="sm" onClick={openNew} disabled={saving}>
            <Plus className="h-4 w-4" />
            Új mértékegység
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="ea-table-head">
              <tr>
                <th className="px-4 py-3 text-left">Kód</th>
                <th className="px-4 py-3 text-left">Név</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                    Még nincs mértékegység. Hozz létre egyet a fenti gombbal.
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="border-b last:border-b-0 hover:bg-[var(--muted)]/40">
                    <td className="px-4 py-3 font-code font-medium text-[var(--brand)]">
                      {unit.code}
                    </td>
                    <td className="px-4 py-3">{unit.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(unit)}
                          disabled={saving}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Szerk.
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void handleDelete(unit)}
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Mértékegység szerkesztése" : "Új mértékegység"}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-code">Kód (ME)</Label>
              <Input
                id="unit-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="pl. m², db, óra"
                className="font-code"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-name">Név</Label>
              <Input
                id="unit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="pl. négyzetméter"
                autoComplete="off"
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Mégse
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Mentés…" : "Mentés"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
