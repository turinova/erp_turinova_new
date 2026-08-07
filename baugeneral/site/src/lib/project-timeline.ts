import type { ProjectPhase } from "@/lib/projects"
import {
  getProjectPhaseIndex,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_ORDER,
} from "@/lib/projects"

export type ProjectTimelineInput = {
  startedAt: string
  expectedCompletion: string
  /** Ha megadva, felülírja a dátum alapú fázist */
  currentPhase?: ProjectPhase
}

export type ProjectTimelineState = {
  phase: ProjectPhase
  phaseIndex: number
  progressPercent: number
  startedAt: Date
  expectedEnd: Date
  today: Date
  isStarted: boolean
  isCompleted: boolean
  isOverdue: boolean
  daysTotal: number
  daysElapsed: number
  daysRemaining: number
}

function parseMonthStart(value: string): Date {
  const [year, month] = value.split("-").map(Number)
  return new Date(year, month - 1, 1)
}

function parseMonthEnd(value: string): Date {
  const start = parseMonthStart(value)
  return new Date(start.getFullYear(), start.getMonth() + 1, 0)
}

const MS_PER_DAY = 86_400_000

export function getProjectTimelineState(
  project: ProjectTimelineInput,
  now: Date = new Date(),
): ProjectTimelineState {
  const startedAt = parseMonthStart(project.startedAt)
  const expectedEnd = parseMonthEnd(project.expectedCompletion)

  const startMs = startedAt.getTime()
  const endMs = expectedEnd.getTime()
  const nowMs = now.getTime()

  const daysTotal = Math.max(1, Math.ceil((endMs - startMs) / MS_PER_DAY))
  const daysElapsed = Math.max(0, Math.ceil((nowMs - startMs) / MS_PER_DAY))
  const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / MS_PER_DAY))

  let progressPercent = 0
  if (nowMs <= startMs) {
    progressPercent = 0
  } else if (nowMs >= endMs) {
    progressPercent = 100
  } else {
    progressPercent = Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)
  }

  const rawIndex = Math.floor((progressPercent / 100) * PROJECT_PHASE_ORDER.length)
  const phaseIndex = Math.min(
    PROJECT_PHASE_ORDER.length - 1,
    progressPercent >= 100 ? PROJECT_PHASE_ORDER.length - 1 : Math.max(0, rawIndex),
  )
  const computedPhase = PROJECT_PHASE_ORDER[phaseIndex]
  const phase = project.currentPhase ?? computedPhase

  return {
    phase,
    phaseIndex: getProjectPhaseIndex(phase),
    progressPercent,
    startedAt,
    expectedEnd,
    today: now,
    isStarted: nowMs >= startMs,
    isCompleted: nowMs >= endMs,
    isOverdue: nowMs > endMs,
    daysTotal,
    daysElapsed,
    daysRemaining,
  }
}

export function formatTimelineMonth(value: string): string {
  const [year, month] = value.split("-")
  return `${year}. ${month}.`
}

export function formatTimelineDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}. ${month}. ${day}.`
}

export function toTimelineISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
