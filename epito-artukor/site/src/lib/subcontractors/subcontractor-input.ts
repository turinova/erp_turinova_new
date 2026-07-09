import type { Subcontractor, SubcontractorInput } from "@/types/subcontractors"

export function subcontractorToInput(sub: Subcontractor): SubcontractorInput {
  return {
    code: sub.code,
    legalName: sub.legalName,
    displayName: sub.displayName,
    taxNumber: sub.taxNumber,
    companyRegNumber: sub.companyRegNumber,
    trades: [...sub.trades],
    tags: [...sub.tags],
    tier: sub.tier,
    status: sub.status,
    email: sub.email,
    phone: sub.phone,
    website: sub.website,
    address: sub.address,
    internalNotes: sub.internalNotes,
    rating: sub.rating,
    contacts: sub.contacts,
    references: sub.references,
  }
}
