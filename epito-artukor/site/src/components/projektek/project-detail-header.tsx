"use client"

import Link from "next/link"
import { Archive, ArrowLeft, MoreHorizontal, Pencil } from "lucide-react"
import type { Project } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import { listHrefForProject, phaseForProject, PROJECT_PHASE_LABELS } from "@/lib/project-phase"
import { getClient } from "@/lib/data/clients-store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ProjectDetailHeaderProps = {
  project: Project
  /** Egy mondat: hol tart / mi hiányzik (nem badge-halom) */
  statusLine?: string | null
  onEdit?: () => void
  onClose?: () => void
}

export function ProjectDetailHeader({
  project,
  statusLine,
  onEdit,
  onClose,
}: ProjectDetailHeaderProps) {
  const linkedClient = project.clientId ? getClient(project.clientId) : undefined
  const hasMenu = Boolean(onEdit || onClose)

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
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium text-slate-900">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
              {statusLine ? (
                <>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span>{statusLine}</span>
                </>
              ) : null}
            </p>
            {project.description ? (
              <p className="mt-2 text-sm text-slate-600">{project.description}</p>
            ) : null}
          </div>
        </div>

        {hasMenu ? (
          <div className="flex shrink-0 items-center gap-2 self-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  aria-label="További műveletek"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[11rem] p-1">
                {onEdit ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
                    onClick={onEdit}
                  >
                    <Pencil className="h-4 w-4" />
                    Szerkesztés
                  </button>
                ) : null}
                {onClose ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
                    onClick={onClose}
                  >
                    <Archive className="h-4 w-4" />
                    Lezárás
                  </button>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </header>
  )
}
