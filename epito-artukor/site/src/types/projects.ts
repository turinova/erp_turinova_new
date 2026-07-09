import type { Trade } from "@/types"

export type ProjectStatus =
  | "prospect"
  | "quoting"
  | "won"
  | "in_progress"
  | "done"
  | "archived"

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "archived"

/** Szakági ajánlat | ugyanannak új verziója */
export type QuoteScope = "trade" | "version"

/** Bekerülés | fedezet | ügyfél előnézet */
export type QuotePriceSide = "cost" | "markup" | "sell"

/** ÁFA kezelés az ügyfél ajánlat összesítőben */
export type QuoteVatMode = "standard" | "reduced" | "aam" | "reverse_charge"

export type QuoteLinePricingStatus =
  | "unpriced"
  | "estimated"
  | "rfq_pending"
  | "costed"

export type QuoteLineCostSource =
  | "unpriced"
  | "catalog"
  | "manual"
  | "subcontractor"

/** Kivitelezés — tétel fizikai készültsége (nem árazási státusz) */
export type QuoteLineExecutionStatus = "pending" | "done"

/** Bekérés (csomag) állapota — legacy értékek (draft/sent/received/closed) migrációnál normalizálódnak */
export type SubcontractorRfqStatus = "open" | "decided"

export type RfqInvitationStatus =
  | "invited"
  | "submitted"
  | "accepted"
  | "rejected"

export type RfqDecisionAction = "accept_package" | "change_package_winner"

export interface Project {
  id: string
  orgId: string
  code: string
  name: string
  /** Ügyfél törzs hivatkozás — ha nincs, clientName snapshot */
  clientId?: string
  clientName: string
  siteAddress: string
  description: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface Quote {
  id: string
  projectId: string
  title: string
  status: QuoteStatus
  version: number
  notes: string
  /** Szakági / verzió — migráció után mindig kitöltött */
  quoteScope?: QuoteScope
  /** Szakág — kötelező szakági ajánlatnál */
  primaryTrade?: Trade
  /** Ha quoteScope === "version" — melyik ajánlatot váltja fel */
  supersedesQuoteId?: string
  /** Szakági alap fedezet % — sor örökli, ha nincs saját markupPercent */
  tradeMarkups: Partial<Record<Trade, number>>
  /** ÁFA mód — default: standard (27%) */
  vatMode?: QuoteVatMode
  createdAt: string
  updatedAt: string
}

export interface QuoteLine {
  id: string
  quoteId: string
  sortOrder: number
  costItemId: string | null
  identifierSnapshot: string
  textSnapshot: string
  trade: Trade
  unitId: string
  quantity: number
  /** Bekerülési oldal — anyag egységár */
  costMaterialUnitPrice: number
  /** Bekerülési oldal — díj egységre */
  costLaborUnitPrice: number
  /** Soronkénti fedezet % felülírás (null = szakági alap) */
  markupPercent: number | null
  costSource: QuoteLineCostSource
  costSourceSubcontractor: string | null
  costSourceRfqSubmissionId: string | null
  pricingStatus: QuoteLinePricingStatus
  /** Kivitelezés — hiányzó = nem kész */
  executionStatus?: QuoteLineExecutionStatus
  /** Teljesítésigazolásban szerepel — ha kitöltött, a tétel már igazolt */
  tigDocumentId?: string
}

export interface SubcontractorRfqLine {
  id: string
  quoteLineId: string | null
  text: string
  unitId: string
  quantity: number
}

/** Bekérés csomag — egy tételkészlet, több meghívott alvállalkozó */
export interface SubcontractorRfq {
  id: string
  projectId: string
  quoteId: string
  trade: Trade
  title: string
  status: SubcontractorRfqStatus
  expiresAt: string
  lines: SubcontractorRfqLine[]
  createdAt: string
  /** Több csomagot összekötő kampány (batch bekérés) */
  campaignId?: string
}

/** Egy mentéssel indított több szakágos bekérés */
export interface RfqCampaign {
  id: string
  projectId: string
  message?: string
  expiresAt: string
  attachedFolderIds: string[]
  attachedFolderSnapshots: Array<{
    folderId: string
    name: string
    fileCount: number
  }>
  createdAt: string
}

/** Egy alvállalkozó meghívása — saját link + kód */
export interface RfqInvitation {
  id: string
  packageId: string
  /** Ha a partner törzsből jön */
  subcontractorId?: string
  subcontractorName: string
  contactPhone: string
  accessToken: string
  accessCode: string
  status: RfqInvitationStatus
  createdAt: string
}

export interface SubcontractorRfqLineBid {
  rfqLineId: string
  materialUnitPrice: number
  laborUnitPrice: number
  declined: boolean
  /** @deprecated v1 összesített egységár */
  unitPrice?: number
}

export interface SubcontractorRfqSubmission {
  id: string
  /** Bekérés csomag id */
  rfqId: string
  invitationId: string
  subcontractorId?: string
  subcontractorName: string
  contactEmail: string
  contactPhone: string
  notes: string
  lineBids: SubcontractorRfqLineBid[]
  totalAmount: number
  submittedAt: string
  updatedAt: string
  /** Korábbi beküldések (újraárazás előzmény) */
  revisionHistory?: Array<{
    totalAmount: number
    updatedAt: string
    notes?: string
  }>
}

export interface RfqDecisionLogEntry {
  id: string
  packageId: string
  quoteId: string
  invitationId: string
  quoteLineId: string | null
  action: RfqDecisionAction
  subcontractorName: string
  marginPercentBefore: number | null
  marginPercentAfter: number | null
  createdAt: string
  /** Ki hozta meg a döntést (belső felhasználó) */
  decidedByUserId?: string
  decidedByEmail?: string
  decidedByName?: string
}

export type ProjectAuditKind = "quote" | "rfq" | "file" | "project" | "decision"

/** Belső felhasználói művelet napló — projekt áttekintés „Ki” oszlop */
export interface ProjectAuditEntry {
  id: string
  projectId: string
  actorUserId: string
  actorEmail: string
  actorName: string
  kind: ProjectAuditKind
  action: string
  context?: string
  at: string
}

/** Egy szakághoz kiválasztott ajánlat a projekt összeállításban */
export interface CompositionSelection {
  trade: Trade
  quoteId: string
  /** Későbbi tételszintű szűrés */
  lineIds?: string[]
}

/** Élő projekt terv — mely szakági ajánlatok számítanak a bruttóba */
export interface ProjectComposition {
  projectId: string
  selections: CompositionSelection[]
  updatedAt: string
}

export type CustomerPackageType = "full" | "supplement"
export type CustomerPackageStatus = "draft" | "sent" | "accepted" | "rejected" | "superseded"

/** Befagyott tételsor — küldéskor rögzítve, az ügyfél ezt látja */
export interface CustomerPackageSnapshotLine {
  lineId: string
  identifier: string
  text: string
  unitLabel: string
  quantity: number
  sellNetUnitPrice: number
  sellNetTotal: number
}

export interface CustomerPackageSnapshot {
  trade: Trade
  quoteId: string
  quoteTitle: string
  sellNetTotal: number
  grossTotal: number
  vatMode?: QuoteVatMode
  vatLabel?: string
  lineIds?: string[]
  /** Küldéskori tételes pillanatkép — régi csomagoknál hiányozhat */
  lines?: CustomerPackageSnapshotLine[]
}

/** Ügyfélnek küldött ajánlat-csomag (pillanatkép) */
export interface CustomerPackage {
  id: string
  projectId: string
  type: CustomerPackageType
  status: CustomerPackageStatus
  title: string
  snapshots: CustomerPackageSnapshot[]
  sellNetTotal: number
  grossTotal: number
  sentAt: string
  notes?: string
  respondedAt?: string
  clientNotes?: string
  /** Részleges elfogadásnál — ha hiányzik és accepted, minden snapshot elfogadott */
  acceptedSnapshots?: CustomerPackageSnapshot[]
  /** Elfogadott összegek — részlegesnél az elfogadott snapshotok összege, teljesnél = sellNetTotal/grossTotal */
  acceptedSellNetTotal?: number
  acceptedGrossTotal?: number
  /** Publikus ajánlat-link */
  accessToken?: string
  accessCode?: string
  /** Ajánlat érvényessége */
  expiresAt?: string
  /** Linken vagy kézzel rögzített ügyfél neve */
  respondedByName?: string
}

/** Teljesítésigazolás (TIG) — egy rögzített igazolás dokumentuma */
export interface PerformanceCertificateLine {
  lineId: string
  quoteId: string
  quoteTitle: string
  trade: Trade
  identifier: string
  text: string
  unitLabel: string
  quantity: number
  sellNetUnitPrice: number
  sellNetTotal: number
}

export interface PerformanceCertificate {
  id: string
  projectId: string
  /** Emberi olvasható sorszám pl. TIG-IRO-2026-03-001 */
  documentNumber: string
  issuedAt: string
  /** Szerződéses hivatkozás */
  contractPackageId?: string
  contractPackageTitle?: string
  /** Teljesítés időszaka — kezdet (opcionális) */
  periodFrom?: string
  /** Teljesítés időszaka — vége */
  periodTo: string
  /** Teljesítés helye */
  performanceLocation: string
  lines: PerformanceCertificateLine[]
  sellNetTotal: number
  grossTotal: number
  vatMode: QuoteVatMode
  vatLabel: string
  vatAmount: number
  notes?: string
  createdAt: string
}

export interface ProjectDataBundle {
  projects: Project[]
  quotes: Quote[]
  quoteLines: QuoteLine[]
  rfqs: SubcontractorRfq[]
  rfqCampaigns?: RfqCampaign[]
  rfqInvitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  rfqDecisionLogs: RfqDecisionLogEntry[]
  auditLog?: ProjectAuditEntry[]
  compositions: ProjectComposition[]
  customerPackages: CustomerPackage[]
  performanceCertificates?: PerformanceCertificate[]
}
