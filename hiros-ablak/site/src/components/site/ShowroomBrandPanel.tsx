import {
  SHOWROOM_BRAND_GROUPS,
  SHOWROOM_DEFAULT_HREF,
} from "@/lib/showroom-brands"
import { BrandChipGroup } from "@/components/site/BrandChips"

type ShowroomBrandPanelProps = {
  className?: string
}

export function ShowroomBrandPanel({ className = "" }: ShowroomBrandPanelProps) {
  return (
    <div className={`grid gap-8 lg:grid-cols-2 ${className}`.trim()}>
      {SHOWROOM_BRAND_GROUPS.map((group) => (
        <BrandChipGroup
          key={group.id}
          label={group.label}
          linked
          items={group.brands.map((b) => ({
            name: b.name,
            href: SHOWROOM_DEFAULT_HREF,
          }))}
        />
      ))}
    </div>
  )
}
