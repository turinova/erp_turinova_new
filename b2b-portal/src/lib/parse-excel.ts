import * as XLSX from "xlsx";

export type ExcelOrderLine = {
  sku: string;
  quantity: number;
  rawText: string;
};

function looksLikeHeader(a: string, b: string): boolean {
  const x = `${a} ${b}`.toLowerCase();
  return /cikk|sku|ean|gtin|kod|kód|model|qty|db|menny|darab|quantity/.test(x);
}

/** Első munkalap → cikkszám + mennyiség sorok */
export function parseExcelBuffer(buf: Buffer): ExcelOrderLine[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  ) as (string | number)[][];

  const out: ExcelOrderLine[] = [];
  rows.forEach((row, idx) => {
    if (!row || !row.length) return;
    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    if (!c0) return;
    if (idx === 0 && looksLikeHeader(c0, c1)) return;
    const qty = Math.max(1, parseInt(c1 || "1", 10) || 1);
    out.push({
      sku: c0,
      quantity: Math.min(99999, qty),
      rawText: c1 ? `${c0}\t${c1}` : c0,
    });
  });
  return out.slice(0, 500);
}
