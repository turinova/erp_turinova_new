/** PDF katalógusok a Nettfront front típusokhoz — bővíthető. */
export type NettfrontCatalogEntry = {

  /** Rövid cím a linken (pl. „Inomat katalógus (PDF)”) */
  label: string
  href: string
}

export const NETTFRONT_CATALOGS: Partial<Record<string, NettfrontCatalogEntry>> = {
  inomat: {
    label: 'Inomat katalógus (PDF)',
    href: 'https://nettfront.hu/sites/default/files/uploads/documents/inomat_katalogus.pdf'
  }

  // festett: { label: '…', href: '…' },
  // folias: …
  // alu: …
}

export function getNettfrontCatalog(frontTypeValue: string): NettfrontCatalogEntry | undefined {
  return NETTFRONT_CATALOGS[frontTypeValue]
}
