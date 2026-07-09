"use client"

import { useEffect, useState } from "react"
import type { Project, ProjectStatus } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import { ClientSelect } from "@/components/ugyfelek/client-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EDITABLE_STATUSES: ProjectStatus[] = [
  "prospect",
  "quoting",
  "won",
  "in_progress",
  "done",
  "archived",
]

export type ProjectEditForm = {
  code: string
  name: string
  clientId: string
  clientName: string
  siteAddress: string
  description: string
  status: ProjectStatus
}

function projectToForm(project: Project): ProjectEditForm {
  return {
    code: project.code,
    name: project.name,
    clientId: project.clientId ?? "",
    clientName: project.clientName,
    siteAddress: project.siteAddress,
    description: project.description,
    status: project.status,
  }
}

type ProjectEditDialogProps = {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (form: ProjectEditForm) => void
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSave,
}: ProjectEditDialogProps) {
  const [form, setForm] = useState<ProjectEditForm>(() =>
    project ? projectToForm(project) : {
      code: "",
      name: "",
      clientId: "",
      clientName: "",
      siteAddress: "",
      description: "",
      status: "prospect",
    }
  )

  useEffect(() => {
    if (project && open) setForm(projectToForm(project))
  }, [project, open])

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim()) return
    onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Projekt adatai</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="proj-code">Projekt kód</Label>
            <Input
              id="proj-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="HYUN-2026-01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-name">Projekt neve</Label>
            <Input
              id="proj-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Ügyfél</Label>
            <ClientSelect
              value={form.clientId}
              onChange={(clientId, client) =>
                setForm((f) => ({
                  ...f,
                  clientId,
                  clientName: client?.displayName ?? f.clientName,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-site">Helyszín</Label>
            <Input
              id="proj-site"
              value={form.siteAddress}
              onChange={(e) => setForm((f) => ({ ...f, siteAddress: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-desc">Megjegyzés</Label>
            <Textarea
              id="proj-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Projekt státusz</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            Az ÁFA szakágonként állítható: költségvetés megnyitása → Ügyfél nézet.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || !form.code.trim()}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
