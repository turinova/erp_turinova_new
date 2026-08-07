import type { ProjectOwnership } from "@/lib/projects"
import { PROJECT_OWNERSHIP_LABELS } from "@/lib/projects"

export function ProjectOwnershipChip({
  ownership,
  onImage = false,
}: {
  ownership: ProjectOwnership
  onImage?: boolean
}) {
  const isOwn = ownership === "own-investment"

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        onImage
          ? isOwn
            ? "border border-white/25 bg-[var(--color-brand)]/85 text-white"
            : "border border-white/20 bg-black/35 text-white/90 backdrop-blur-sm"
          : isOwn
            ? "border border-[var(--color-brand)]/20 bg-[var(--color-brand-subtle)] text-[var(--color-brand)]"
            : "border border-black/10 bg-white/80 text-black/70",
      ].join(" ")}
    >
      {PROJECT_OWNERSHIP_LABELS[ownership]}
    </span>
  )
}
