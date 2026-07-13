import type { Borders, Fill, Font, Style } from "exceljs"

const borderColor = { argb: "FFB4B4B4" }
const borderThin = { style: "thin" as const, color: borderColor }

export const EXCEL_THEME = {
  colors: {
    headerBg: "FFECECEC",
    headerText: "FF404040",
    sectionBg: "FFFFF8E1",
    zebraBg: "FFFAFAFA",
    computedBg: "FFF5F5F5",
    unpricedBg: "FFFFF7ED",
    footerBg: "FFE8EEF4",
    grandTotalBg: "FFDBEAFE",
    titleText: "FF1E293B",
    moneyText: "FF0F172A",
    border: "FFB4B4B4",
    separator: "FF808080",
    marginBlockBg: "FFE8F5E9",
    marginSeparatorBg: "FFE2E8F0",
  },
  fonts: {
    body: { name: "Calibri", size: 10, color: { argb: "FF334155" } } satisfies Partial<Font>,
    bodyBold: { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } } satisfies Partial<Font>,
    header: { name: "Calibri", size: 9, bold: true, color: { argb: "FF404040" } } satisfies Partial<Font>,
    title: { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E293B" } } satisfies Partial<Font>,
    subtitle: { name: "Calibri", size: 10, color: { argb: "FF475569" } } satisfies Partial<Font>,
    org: { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E293B" } } satisfies Partial<Font>,
    code: { name: "Consolas", size: 9, color: { argb: "FF1D4ED8" } } satisfies Partial<Font>,
    grandTotal: { name: "Calibri", size: 12, bold: true, color: { argb: "FF1E3A5F" } } satisfies Partial<Font>,
  },
  numFmt: {
    /** Vessző = Excel ezres-tagoló (hu-HU-ban szóköz jelenik meg); a „# ##0” csak ~999 999-ig tagol. */
    money: "#,##0",
    moneyFt: '#,##0" Ft"',
    percent: '0"%"',
  },
} as const

/** Mennyiség formátum — egész számnál nincs tizedesvessző (hu-HU: „281,” elkerülése). */
export function quantityNumFmt(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return "# ##0"
  }
  return "# ##0.###"
}

export function thinBorder(): Partial<Borders> {
  return {
    top: borderThin,
    left: borderThin,
    bottom: borderThin,
    right: borderThin,
  }
}

export function solidFill(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } }
}

export function mergeStyle(base: Partial<Style>, extra: Partial<Style>): Partial<Style> {
  return {
    ...base,
    ...extra,
    font: { ...base.font, ...extra.font },
    alignment: { ...base.alignment, ...extra.alignment },
    border: { ...base.border, ...extra.border },
    fill: extra.fill ?? base.fill,
  }
}
