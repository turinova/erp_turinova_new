"use client"

import { useMemo, useState } from "react"
import { Archive, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { buildProjectCloseReadiness, buildExecutionSummary } from "@/lib/execution-summary"
import { closeProject } from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ProjectCloseDialogProps = {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  tick: number
  onClosed: () => void
}

export function ProjectCloseDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  tick,
  onClosed,
}: ProjectCloseDialogProps) {
  const [closing, setClosing] = useState(false)

  const readiness = useMemo(() => {
    void tick
    return buildProjectCloseReadiness(projectId)
  }, [projectId, tick])

  const summary = useMemo(() => {
    void tick
    return buildExecutionSummary(projectId)
  }, [projectId, tick])

  const handleClose = () => {
    setClosing(true)
    const result = closeProject(projectId)
    setClosing(false)
    if (!result) {
      toast.error("A projekt lezárása nem sikerült")
      return
    }
    toast.success("Projekt lezárva")
    onClosed()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Projekt lezárása</DialogTitle>
          <DialogDescription>
            „{projectName}” — a projekt kész állapotba kerül és az archív listában jelenik meg.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {readiness.blockers.length > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-950">
              <p className="font-semibold">Nem zárható le</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {readiness.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Figyelmeztetések
              </p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {readiness.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-2 rounded-md border bg-slate-50 px-3 py-2 text-xs">
            <div>
              <dt className="text-slate-600">Készültség</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {summary.executionPercent}%
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">TIG-elt</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {summary.tigPercentOfContract}%
              </dd>
            </div>
          </dl>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            type="button"
            className="gap-1.5 bg-slate-800 hover:bg-slate-900"
            disabled={!readiness.canClose || closing}
            onClick={handleClose}
          >
            <Archive className="h-4 w-4" />
            Lezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
