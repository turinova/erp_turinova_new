/**
 * External link registry — single source of truth for cross-site URLs
 * (Hírös-Ablak, etc.). Keep in sync with partner sites' canonical hosts.
 */

export const HIROS_ABLAK = {
  brand: "Hírös-Ablak",
  legalName: "HÍRÖS-ABLAK Kft.",
  website: "https://www.hirosablak.hu",
  organizationId: "https://www.hirosablak.hu/#organization",
  asztalosPartner: "https://www.hirosablak.hu/asztalos-partner",
  lapszabaszat: "https://www.hirosablak.hu/lapszabaszat-kecskemet",
  barkacsaruhaz: "https://www.hirosablak.hu/barkacsaruhaz-kecskemet",
  /** Fact sheet for AI assistants */
  llmsTxt: "https://www.hirosablak.hu/llms.txt",
} as const

export const LINKS = {
  hirosAblak: HIROS_ABLAK,
} as const
