"use client"

import { useMemo } from "react"
import {
  formatTimelineDate,
  formatTimelineMonth,
  getProjectTimelineState,
  type ProjectTimelineInput,
} from "@/lib/project-timeline"
import {
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_ORDER,
} from "@/lib/projects"

type ProjectPhaseCardProps = ProjectTimelineInput

export function ProjectPhaseCard({
  startedAt,
  expectedCompletion,
  currentPhase,
}: ProjectPhaseCardProps) {
  const timeline = useMemo(
    () => getProjectTimelineState({ startedAt, expectedCompletion, currentPhase }),
    [startedAt, expectedCompletion, currentPhase],
  )

  const { phase, progressPercent, daysRemaining, daysElapsed, isOverdue, isCompleted } = timeline
  const level = timeline.phaseIndex + 1
  const totalLevels = PROJECT_PHASE_ORDER.length

  const countdownLabel = isCompleted
    ? "Átadás előtt"
    : isOverdue
      ? "Ütem túllépve"
      : `${daysRemaining} nap hátra`

  return (
    <section
      aria-labelledby="project-phase-heading"
      className="project-phase-card overflow-hidden rounded-[var(--radius-md)] border border-black/10 bg-white shadow-[var(--shadow-soft)]"
    >
      {/* Fejléc — egy sor */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/8 bg-[#1c1a18] px-4 py-2.5 text-white md:px-5">
        <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold">
          {level}/{totalLevels}
        </span>
        <h2
          id="project-phase-heading"
          className="min-w-0 flex-1 text-base font-semibold leading-snug md:text-lg"
        >
          {PROJECT_PHASE_LABELS[phase]}
        </h2>
        <span className="shrink-0 text-sm font-bold tabular-nums text-[#f5c4c8]">
          {progressPercent}%
        </span>
        <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
        <span className="shrink-0 text-sm text-white/75">{countdownLabel}</span>
      </div>

      <div className="px-4 py-3 md:px-5">
        {/* Dátumok — egy sorban, számozva */}
        <div className="flex flex-col gap-2 sm:flex-row sm:divide-x sm:divide-black/10">
          <TimelinePoint
            step={1}
            label="Kezdés"
            value={formatTimelineMonth(startedAt)}
          />
          <TimelinePoint
            step={2}
            label="Ma"
            value={formatTimelineDate(timeline.today)}
            sub={`${daysElapsed} nap eltelt`}
            active
          />
          <TimelinePoint
            step={3}
            label="Várható átadás"
            value={formatTimelineMonth(expectedCompletion)}
          />
        </div>

        {/* Haladás sáv */}
        <div className="mt-3">
          <div className="relative h-3 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-hover)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Mérföldkövek — egy sor, számozva */}
        <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROJECT_PHASE_ORDER.map((step, index) => {
            const stepNum = index + 1
            const isDone = index < timeline.phaseIndex
            const isCurrent = index === timeline.phaseIndex

            return (
              <li
                key={step}
                className={[
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5",
                  isCurrent
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                    : isDone
                      ? "border-[var(--color-brand)]/25 bg-[var(--color-brand-subtle)] text-black/80"
                      : "border-black/10 bg-stone-50 text-black/45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isDone
                        ? "bg-[var(--color-brand)] text-white"
                        : "bg-black/8 text-black/50",
                  ].join(" ")}
                  aria-hidden
                >
                  {isDone ? <CheckIcon /> : stepNum}
                </span>
                <span className="whitespace-nowrap text-sm font-medium">
                  {PROJECT_PHASE_LABELS[step]}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function TimelinePoint({
  step,
  label,
  value,
  sub,
  active = false,
}: {
  step: number
  label: string
  value: string
  sub?: string
  active?: boolean
}) {
  return (
    <div
      className={[
        "flex min-w-0 flex-1 items-center gap-2.5 sm:px-3 sm:first:pl-0 sm:last:pr-0",
        active ? "rounded-[var(--radius-sm)] bg-[var(--color-live)]/[0.06] px-2 py-1 sm:bg-transparent sm:py-0" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          active
            ? "bg-[var(--color-live)] text-white"
            : "bg-black/6 text-black/50",
        ].join(" ")}
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">{label}</p>
        <p className="text-sm font-bold tabular-nums text-black/85 md:text-base">{value}</p>
        {sub ? <p className="text-xs text-black/45">{sub}</p> : null}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
