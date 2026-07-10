export type ClientProjectCounts = {
  byClientId: Record<string, number>
  byClientName: Record<string, number>
}

export type SubcontractorRfqStatsRow = {
  invitationCount: number
  submittedCount: number
  acceptedCount: number
  rejectedCount: number
  lastSubmissionAt: string | null
}

export type SubcontractorRfqStatsMap = Record<string, SubcontractorRfqStatsRow>
