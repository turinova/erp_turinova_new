import type { ProjectPhase } from "@/lib/projects"
import {
  getProjectPhaseIndex,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_ORDER,
} from "@/lib/projects"

type ProjectPhaseBarProps = {
  phase: ProjectPhase
  compact?: boolean
}

export function ProjectPhaseBar({ phase, compact = false }: ProjectPhaseBarProps) {
  const currentIndex = getProjectPhaseIndex(phase)

  return (
    <div
      className={compact ? "w-full" : "w-full max-w-3xl"}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={PROJECT_PHASE_ORDER.length}
      aria-valuenow={currentIndex + 1}
      aria-label={`Aktuális fázis: ${PROJECT_PHASE_LABELS[phase]}`}
    >
      <div className="flex items-center gap-1">
        {PROJECT_PHASE_ORDER.map((step, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {index > 0 ? (
                  <span
                    className={[
                      "h-0.5 flex-1",
                      isDone || isCurrent ? "bg-[var(--color-brand)]" : "bg-black/10",
                    ].join(" ")}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={[
                    "relative shrink-0 rounded-full border-2",
                    compact ? "h-3 w-3" : "h-4 w-4",
                    isDone
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                      : isCurrent
                        ? "border-[var(--color-brand)] bg-white"
                        : "border-black/15 bg-white",
                  ].join(" ")}
                  aria-hidden
                >
                  {isCurrent ? (
                    <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-brand)] opacity-40" />
                  ) : null}
                </span>
                {index < PROJECT_PHASE_ORDER.length - 1 ? (
                  <span
                    className={[
                      "h-0.5 flex-1",
                      isDone ? "bg-[var(--color-brand)]" : "bg-black/10",
                    ].join(" ")}
                    aria-hidden
                  />
                ) : null}
              </div>
              {!compact ? (
                <span
                  className={[
                    "hidden text-center text-xs leading-tight sm:block md:text-sm",
                    isCurrent
                      ? "font-semibold text-[var(--color-brand)]"
                      : isDone
                        ? "font-medium text-black/60"
                        : "text-black/40",
                  ].join(" ")}
                >
                  {PROJECT_PHASE_LABELS[step]}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {compact ? (
        <p className="mt-2 text-sm font-medium text-black/70 md:text-base">
          {PROJECT_PHASE_LABELS[phase]}
        </p>
      ) : null}
    </div>
  )
}
