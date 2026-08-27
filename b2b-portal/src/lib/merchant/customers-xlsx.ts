import * as XLSX from "xlsx-js-style";

export const CUSTOMER_EXPORT_HEADERS = [
  "email",
  "nev",
  "csoport",
] as const;

/** Import reads email + csoport; nev is ignored if present (round-trip friendly). */
export const CUSTOMER_IMPORT_HEADERS = ["email", "csoport"] as const;

export type CustomerExportRow = {
  email: string;
  name: string;
  groupName: string;
  groupInnerId: number | null;
  innerId: number;
};

export type CustomerImportRawRow = {
  row: number;
  email: string;
  groupRaw: string;
};

const HEADER_STYLE = {
  font: { bold: true, sz: 11, name: "Calibri" },
  fill: { patternType: "solid" as const, fgColor: { rgb: "E8F3FC" } },
  alignment: { vertical: "center" as const },
};

function sheetFromAoA(aoa: (string | number)[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    const cell = ws[addr];
    if (cell) cell.s = HEADER_STYLE;
  }
  ws["!cols"] = aoa[0]!.map((_, i) => ({
    wch: Math.min(
      40,
      Math.max(
        12,
        ...aoa.map((row) => String(row[i] ?? "").length + 2),
      ),
    ),
  }));
  return ws;
}

export function buildCustomersExportWorkbook(
  rows: CustomerExportRow[],
  groupNames: string[] = [],
): Buffer {
  const aoa: (string | number)[][] = [
    [...CUSTOMER_EXPORT_HEADERS],
    ...rows.map((r) => [r.email, r.name, r.groupName]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(aoa), "Vevok");
  if (groupNames.length > 0) {
    const groupsAoa: (string | number)[][] = [
      ["csoport"],
      ...groupNames.map((n) => [n]),
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromAoA(groupsAoa), "Csoportok");
  }
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

export function buildCustomersImportTemplateWorkbook(
  groupNames: string[],
): Buffer {
  const aoa: (string | number)[][] = [
    ["email", "nev", "csoport"],
    ["pelda@ceg.hu", "Pelda Partner", groupNames[0] || "Partner"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(aoa), "Vevok");
  if (groupNames.length > 0) {
    const groupsAoa: (string | number)[][] = [
      ["csoport"],
      ...groupNames.map((n) => [n]),
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromAoA(groupsAoa), "Csoportok");
  }
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
}

function findCol(
  headers: string[],
  aliases: string[],
): number {
  const norms = headers.map(normHeader);
  for (const a of aliases) {
    const i = norms.indexOf(normHeader(a));
    if (i >= 0) return i;
  }
  return -1;
}

/** Parse first sheet → email + group columns (max rows). */
export function parseCustomerImportBuffer(
  buf: Buffer,
  maxRows = 500,
): CustomerImportRawRow[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheetName =
    wb.SheetNames.find((n) => normHeader(n) === "vevok") || wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  ) as (string | number)[][];

  if (rows.length === 0) return [];

  const headerRow = rows[0]!.map((c) => String(c ?? ""));
  let emailCol = findCol(headerRow, [
    "email",
    "e-mail",
    "mail",
    "e_mail",
  ]);
  let groupCol = findCol(headerRow, [
    "csoport",
    "group",
    "csoport_id",
    "group_id",
    "cel_csoport",
  ]);

  let start = 1;
  if (emailCol < 0 || groupCol < 0) {
    /* No header — A email, last col csoport (B if 2 cols, C if email/nev/csoport) */
    emailCol = 0;
    groupCol = headerRow.length >= 3 ? 2 : 1;
    start = 0;
  }

  const out: CustomerImportRawRow[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const email = String(row[emailCol] ?? "")
      .trim()
      .toLowerCase();
    const groupRaw = String(row[groupCol] ?? "").trim();
    if (!email && !groupRaw) continue;
    if (i === start && emailCol === 0 && /email|mail/i.test(email)) continue;
    out.push({ row: i + 1, email, groupRaw });
    if (out.length >= maxRows) break;
  }
  return out;
}

export function xlsxResponse(
  buf: Buffer,
  filename: string,
): Response {
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
