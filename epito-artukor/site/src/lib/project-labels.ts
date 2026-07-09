import type {
  Project,
  Quote,
  RfqInvitationStatus,
  SubcontractorRfq,
} from "@/types/projects"

export const PROJECT_STATUS_LABELS: Record<Project["status"], string> = {
  prospect: "Lehetőség",
  quoting: "Ajánlatkészítés",
  won: "Megnyert",
  in_progress: "Kivitelezés",
  done: "Kész",
  archived: "Archivált",
}

export const QUOTE_STATUS_LABELS: Record<Quote["status"], string> = {
  draft: "Piszkozat",
  sent: "Elküldve",
  accepted: "Elfogadva",
  rejected: "Elutasítva",
  archived: "Archivált",
}

export const QUOTE_SCOPE_LABELS: Record<NonNullable<Quote["quoteScope"]>, string> = {
  trade: "Szakág",
  version: "Verzió",
}

export const RFQ_STATUS_LABELS: Record<SubcontractorRfq["status"], string> = {
  open: "Nyitott",
  decided: "Döntés megszületett",
}

export const RFQ_INVITATION_STATUS_LABELS: Record<RfqInvitationStatus, string> = {
  invited: "Meghívva",
  submitted: "Beküldve",
  accepted: "Elfogadva",
  rejected: "Elutasítva",
}
