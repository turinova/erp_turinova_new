import type { Subcontractor } from "@/types/subcontractors"

export const SUBCONTRACTOR_STATUS_LABELS: Record<Subcontractor["status"], string> = {
  active: "Aktív",
  inactive: "Inaktív",
  blocked: "Tiltott",
  prospect: "Lehetőség",
}

export const SUBCONTRACTOR_TIER_LABELS: Record<Subcontractor["tier"], string> = {
  preferred: "Kiemelt",
  standard: "Standard",
  reserve: "Tartalék",
  new: "Új",
}
