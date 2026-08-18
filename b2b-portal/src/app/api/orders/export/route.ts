import * as XLSX from "xlsx-js-style";
import { NextResponse } from "next/server";
import {
  getCustomerOrderDetail,
  getShoprenterConfigForRequest,
  type CustomerOrderDetail,
  type CustomerOrderLine,
} from "@/lib/shoprenter";
import { corsHeadersForRequest, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

const MAX_EXPORT_ORDERS = 25;
const COL_COUNT = 10;

type Cell = string | number;

type Style = {
  font?: {
    bold?: boolean;
    sz?: number;
    color?: { rgb: string };
    underline?: boolean;
    name?: string;
  };
  fill?: { patternType: "solid"; fgColor: { rgb: string } };
  alignment?: {
    horizontal?: "left" | "center" | "right";
    vertical?: "center";
    wrapText?: boolean;
  };
  border?: {
    bottom?: { style: string; color: { rgb: string } };
    top?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
  numFmt?: string;
};

const FONT = "Calibri";

const styleHeader: Style = {
  font: { bold: true, sz: 11, color: { rgb: "1A1917" }, name: FONT },
  fill: { patternType: "solid", fgColor: { rgb: "EFEEE9" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: {
    bottom: { style: "thin", color: { rgb: "C8C6C0" } },
  },
};

const styleBody: Style = {
  font: { sz: 11, color: { rgb: "1A1917" }, name: FONT },
  alignment: { horizontal: "left", vertical: "center" },
  border: {
    bottom: { style: "hair", color: { rgb: "E8E6E1" } },
  },
};

const styleNum: Style = {
  ...styleBody,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "#,##0.00",
};

const styleQty: Style = {
  ...styleBody,
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: "0",
};

const styleLink: Style = {
  font: {
    sz: 11,
    color: { rgb: "1D4E4A" },
    underline: true,
    name: FONT,
  },
  alignment: { horizontal: "center", vertical: "center" },
};

function numOrEmpty(v: number | null | undefined): Cell {
  return typeof v === "number" && Number.isFinite(v) ? v : "";
}

function textCell(v: string | null | undefined): string {
  return v == null ? "" : String(v);
}

function barcodeCell(v: string | null | undefined): string {
  return textCell(v).trim();
}

const LINE_HEADERS = [
  "Rendelésszám",
  "Dátum",
  "Cikkszám",
  "Gyártói cikkszám",
  "Vonalkód",
  "Termék neve",
  "Darab",
  "Nettó egységár",
  "Bruttó egységár",
  "Termék link",
];

function lineRow(o: CustomerOrderDetail, line: CustomerOrderLine): {
  cells: Cell[];
  productUrl: string;
} {
  const productUrl = textCell(line.productUrl).trim();
  return {
    cells: [
      textCell(o.innerId || o.id),
      textCell(o.dateLabel || o.dateCreated),
      textCell(line.sku),
      textCell(line.modelNumber),
      barcodeCell(line.gtin),
      textCell(line.name),
      line.quantity || 0,
      numOrEmpty(line.priceNet),
      numOrEmpty(line.priceGross),
      productUrl ? "Link" : "",
    ],
    productUrl,
  };
}

function applyMinimalStyles(
  ws: XLSX.WorkSheet,
  rows: Cell[][],
  linkByRow: Record<number, string>,
) {
  const rowCount = rows.length;

  for (let c = 0; c < COL_COUNT; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr] || { t: "s", v: LINE_HEADERS[c] };
    cell.s = styleHeader;
    ws[addr] = cell;
  }

  for (let r = 1; r < rowCount; r++) {
    for (let c = 0; c < COL_COUNT; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] || { t: "s", v: "" };
      if (c === 6) {
        cell.s = styleQty;
        if (typeof cell.v === "number") cell.t = "n";
      } else if (c === 7 || c === 8) {
        cell.s = styleNum;
        if (typeof cell.v === "number") cell.t = "n";
      } else if (c === 9 && linkByRow[r]) {
        cell.t = "s";
        cell.v = "Link";
        cell.l = { Target: linkByRow[r], Tooltip: linkByRow[r] };
        cell.s = styleLink;
      } else if (c === 4 && cell.v != null && cell.v !== "") {
        cell.t = "s";
        cell.v = String(cell.v);
        cell.z = "@";
        cell.s = styleBody;
      } else {
        cell.s = styleBody;
      }
      ws[addr] = cell;
    }
  }

  // Szélesség = az oszlop leghosszabb látható tartalma (+ padding), korlátokkal.
  const minW = [8, 8, 8, 10, 8, 12, 5, 10, 10, 6];
  const maxW = [28, 22, 24, 28, 22, 56, 10, 16, 16, 10];
  ws["!cols"] = Array.from({ length: COL_COUNT }, (_, c) => {
    let maxLen = 0;
    for (let r = 0; r < rowCount; r++) {
      let text = "";
      if (c === 9 && r > 0 && linkByRow[r]) {
        text = "Link";
      } else {
        const v = rows[r]?.[c];
        if (v == null || v === "") text = "";
        else if (typeof v === "number") {
          text =
            c === 6
              ? String(Math.round(v))
              : v.toLocaleString("hu-HU", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                });
        } else {
          text = String(v);
        }
      }
      // CJK / hosszú URL nélkül: karakterhossz; magyar ékezet ~1
      const len = text.length;
      if (len > maxLen) maxLen = len;
    }
    const padded = maxLen + 2;
    const wch = Math.min(maxW[c], Math.max(minW[c], padded));
    return { wch };
  });
  ws["!rows"] = [{ hpt: 22 }];
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, rowCount - 1), c: COL_COUNT - 1 },
    }),
  };
}

export async function POST(request: Request) {
  const cors = await corsHeadersForRequest(request);
  try {
    const body = (await request.json()) as {
      userId?: string | number;
      orderIds?: unknown;
    };
    const userId = String(body.userId ?? "").trim();
    const rawIds = Array.isArray(body.orderIds) ? body.orderIds : [];
    const uniqueIds = [
      ...new Set(
        rawIds
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    const truncated = uniqueIds.length > MAX_EXPORT_ORDERS;
    const orderIds = uniqueIds.slice(0, MAX_EXPORT_ORDERS);

    if (!userId || userId === "0") {
      return NextResponse.json(
        { error: "userId required (logged-in customer)" },
        { status: 401, headers: cors },
      );
    }
    if (!orderIds.length) {
      return NextResponse.json(
        { error: "Legalább egy rendelést ki kell választani." },
        { status: 400, headers: cors },
      );
    }

    const config = await getShoprenterConfigForRequest(request);
    const details: CustomerOrderDetail[] = [];
    const errors: string[] = [];

    const CONCURRENCY = 4;
    for (let i = 0; i < orderIds.length; i += CONCURRENCY) {
      const batch = orderIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            return {
              ok: true as const,
              detail: await getCustomerOrderDetail(config, id, userId),
            };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "ismeretlen hiba";
            return { ok: false as const, id, msg };
          }
        }),
      );
      for (const r of results) {
        if (r.ok) details.push(r.detail);
        else errors.push(`#${r.id}: ${r.msg}`);
      }
    }

    if (truncated) {
      errors.push(
        `Figyelem: legfeljebb ${MAX_EXPORT_ORDERS} rendelés exportálható egyszerre. ` +
          `${uniqueIds.length - MAX_EXPORT_ORDERS} kijelölés kimaradt.`,
      );
    }

    if (!details.length) {
      return NextResponse.json(
        {
          error:
            "Nem sikerült a kijelölt rendeléseket betölteni." +
            (errors.length ? " " + errors.join("; ") : ""),
        },
        { status: 400, headers: cors },
      );
    }

    details.sort((a, b) => {
      const ta = Date.parse(a.dateCreated) || 0;
      const tb = Date.parse(b.dateCreated) || 0;
      return tb - ta;
    });

    const lineRows: Cell[][] = [LINE_HEADERS];
    const linkByRow: Record<number, string> = {};
    let emptyOrderCount = 0;
    for (const o of details) {
      const lines = o.lines || [];
      if (!lines.length) {
        emptyOrderCount++;
        lineRows.push([
          textCell(o.innerId || o.id),
          textCell(o.dateLabel || o.dateCreated),
          "",
          "",
          "",
          "(nincs tétel)",
          "",
          "",
          "",
          "",
        ]);
        continue;
      }
      for (const line of lines) {
        const built = lineRow(o, line);
        const rowIndex = lineRows.length;
        lineRows.push(built.cells);
        if (built.productUrl) linkByRow[rowIndex] = built.productUrl;
      }
    }
    if (emptyOrderCount) {
      errors.push(
        `${emptyOrderCount} rendelésnél nem volt exportálható tételsor.`,
      );
    }

    const wb = XLSX.utils.book_new();
    const wsLines = XLSX.utils.aoa_to_sheet(lineRows);
    applyMinimalStyles(wsLines, lineRows, linkByRow);
    XLSX.utils.book_append_sheet(wb, wsLines, "Tetelek");

    if (errors.length) {
      const wsErr = XLSX.utils.aoa_to_sheet([
        ["Figyelmeztetés / hiba"],
        ...errors.map((e) => [e]),
      ]);
      wsErr["!cols"] = [{ wch: 80 }];
      const errHeader = wsErr.A1;
      if (errHeader) {
        errHeader.s = styleHeader;
      }
      XLSX.utils.book_append_sheet(wb, wsErr, "Hibak");
    }

    const bytes = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
      cellStyles: true,
    }) as number[];
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rendeleseim-tetelek-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Export-Orders": String(details.length),
        "X-Export-Lines": String(Math.max(0, lineRows.length - 1)),
        "X-Export-Errors": String(errors.length),
        "X-Export-Truncated": truncated ? "1" : "0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "export failed";
    const status = /bejelentkezés|email/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status, headers: cors });
  }
}
