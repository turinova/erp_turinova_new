"use client"

import type { Subcontractor } from "@/types/subcontractors"
import type { SubcontractorActivityItem, SubcontractorStats } from "@/lib/subcontractor-queries"
import { SubcontractorOverviewSummary } from "@/components/alvalalkozok/subcontractor-overview-summary"
import { SubcontractorQuickContact } from "@/components/alvalalkozok/subcontractor-quick-contact"
import { SubcontractorReferencePreview } from "@/components/alvalalkozok/subcontractor-reference-preview"
import { SubcontractorActivityFeed } from "@/components/alvalalkozok/subcontractor-activity-feed"

type SubcontractorOverviewTabProps = {
  sub: Subcontractor
  stats: SubcontractorStats
  activity: SubcontractorActivityItem[]
  onViewAllReferences: () => void
}

export function SubcontractorOverviewTab({
  sub,
  stats,
  activity,
  onViewAllReferences,
}: SubcontractorOverviewTabProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <SubcontractorOverviewSummary stats={stats} />
      <SubcontractorQuickContact sub={sub} />
      <SubcontractorReferencePreview
        references={sub.references}
        onViewAll={onViewAllReferences}
      />
      <SubcontractorActivityFeed items={activity} />
    </div>
  )
}
