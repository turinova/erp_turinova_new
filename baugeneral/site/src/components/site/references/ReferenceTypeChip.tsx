import { ServiceIcon } from "@/components/site/nav/ServiceIcon"
import type { ReferenceType } from "@/lib/references"
import { REFERENCE_TYPE_ICON, REFERENCE_TYPE_LABELS } from "@/lib/references"

export function ReferenceTypeChip({
  type,
  onImage = false,
}: {
  type: ReferenceType
  onImage?: boolean
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        onImage
          ? "border border-white/25 bg-black/45 text-white backdrop-blur-sm"
          : "border border-black/10 bg-white/90 text-black/75",
      ].join(" ")}
    >
      <ServiceIcon
        icon={REFERENCE_TYPE_ICON[type]}
        className={[
          "h-3.5 w-3.5",
          onImage ? "text-white/85" : "text-black/45",
        ].join(" ")}
      />
      {REFERENCE_TYPE_LABELS[type]}
    </span>
  )
}
