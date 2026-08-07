import type { ProjectCategory } from "@/lib/projects"
import { PROJECT_CATEGORY_LABELS } from "@/lib/projects"

export function ProjectCategoryChip({
  category,
  onImage = false,
}: {
  category: ProjectCategory
  onImage?: boolean
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        onImage
          ? "border border-white/20 bg-black/35 text-white/90 backdrop-blur-sm"
          : "border border-black/10 bg-white/80 text-black/70",
      ].join(" ")}
    >
      {PROJECT_CATEGORY_LABELS[category]}
    </span>
  )
}
