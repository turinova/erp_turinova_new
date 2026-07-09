"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type BulkPriceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  onApply: (percent: number, target: "material" | "labor" | "both") => void
}

export function BulkPriceDialog({ open, onOpenChange, count, onApply }: BulkPriceDialogProps) {
  const [percent, setPercent] = useState(5)
  const [target, setTarget] = useState<"material" | "labor" | "both">("both")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tömeges áremelés</DialogTitle>
          <DialogDescription>{count} kijelölt tétel árának módosítása</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Változás (%)</Label>
            <Input
              type="number"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">Negatív érték = csökkentés</p>
          </div>
          <div className="space-y-2">
            <Label>Mire vonatkozzon</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Anyag + Díj</SelectItem>
                <SelectItem value="material">Csak anyag</SelectItem>
                <SelectItem value="labor">Csak díj</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={() => { onApply(percent, target); onOpenChange(false) }}>
            Alkalmaz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
