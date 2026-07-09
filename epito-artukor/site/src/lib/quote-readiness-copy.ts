/** Belső árazás-állapot szövegek — nem „ügyfélnek küldés”, hanem exportálhatóság */

export function pricingStatusTitle(opts: {
  canSend: boolean
  lineCount: number
  pricedCount: number
}): string {
  if (opts.lineCount === 0) return "Még nincs tétel"
  if (opts.pricedCount === 0) return "Nincs árazott tétel"
  if (opts.canSend) return "Árazás kész"
  return "Hiányos árazás"
}

export function pricingStatusHint(canSend: boolean): string | null {
  if (canSend) return "Exportálható — állítsd „Elküldve” státuszra, ha kiment Excelben"
  return null
}

export const QUOTE_STATUS_HINTS: Record<string, string> = {
  draft: "Belső munka — nem számít a projekt bruttóba",
  sent: "Kiment a megrendelőnek — beleszámít a bruttó projektbe",
  accepted: "Megrendelő elfogadta — beleszámít a bruttó projektbe",
  rejected: "Nem választották — nem számít bele",
  archived: "Régi / nem aktív",
}
