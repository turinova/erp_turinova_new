"use client"

import { useState } from "react"
import { COLUMNS, type ColumnId, loadColumnVisibility, saveColumnVisibility } from "@/lib/column-config"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Columns3 } from "lucide-react"

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState(loadColumnVisibility)
  return { visibility, setVisibility }
}

type ColumnToggleProps = {
  visibility: Record<ColumnId, boolean>
  onChange: (next: Record<ColumnId, boolean>) => void
}

export function ColumnToggle({ visibility, onChange }: ColumnToggleProps) {
  const toggle = (id: ColumnId) => {
    const next = { ...visibility, [id]: !visibility[id] }
    onChange(next)
    saveColumnVisibility(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4" />
          Oszlopok
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-2">
        {COLUMNS.map((col) => (
          <label
            key={col.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
          >
            <Checkbox checked={visibility[col.id]} onCheckedChange={() => toggle(col.id)} />
            {col.label}
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
