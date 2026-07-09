"use client"

import Link from "next/link"
import { ArrowLeft, Archive, Pencil } from "lucide-react"
import type { Project } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import type { ProjectHealth } from "@/lib/project-overview-summary"
import { listHrefForProject, phaseForProject, PROJECT_PHASE_LABELS } from "@/lib/project-phase"
import { getClient } from "@/lib/data/clients-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ProjectDetailHeaderProps = {
  project: Project
  health?: { health: ProjectHealth; label: string } | null
  onEdit?: () => void
  onClose?: () => void
}

function healthBadgeVariant(
  health: ProjectHealth
): "success" | "warning" | "outline" {
  if (health === "ready") return "success"
  if (health === "blocked" || health === "attention") return "warning"
  return "outline"
}

export function ProjectDetailHeader({ project, health, onEdit, onClose }: ProjectDetailHeaderProps) {
  const linkedClient = project.clientId ? getClient(project.clientId) : undefined

  return (
    <header className="mb-4">
      <Link
        href={listHrefForProject(project)}
        className="mb-3 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {PROJECT_PHASE_LABELS[phaseForProject(project)]}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-[var(--page-accent)]"
          />
          <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
            {project.name}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
            <span className="font-code font-semibold text-blue-700">{project.code}</span>
            {project.clientName ? (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                {linkedClient ? (
                  <Link
                    href={`/ugyfelek/${linkedClient.code}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {project.clientName}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-800">{project.clientName}</span>
                )}
              </>
            ) : null}
            {project.siteAddress ? (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{project.siteAddress}</span>
              </>
            ) : null}
          </p>
          {project.description ? (
            <p className="mt-2 text-sm text-slate-600">{project.description}</p>
          ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onClose ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs font-semibold"
              onClick={onClose}
            >
              <Archive className="h-3.5 w-3.5" />
              Lezárás
            </Button>
          ) : null}
          {onEdit ? (
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Szerkesztés
            </Button>
          ) : null}
          {health ? (
            <Badge variant={healthBadgeVariant(health.health)} className="text-xs font-semibold">
              {health.label}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="text-xs font-semibold">
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>
      </div>
    </header>
  )
}
