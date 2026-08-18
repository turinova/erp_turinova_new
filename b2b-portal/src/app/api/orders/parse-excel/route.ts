import { parseExcelBuffer } from "@/lib/parse-excel";
import { jsonWithCors, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return jsonWithCors(
        request,
        { error: "file required (multipart field name: file)" },
        { status: 400 },
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return jsonWithCors(
        request,
        { error: "Max fájlméret 5 MB" },
        { status: 400 },
      );
    }
    const filename =
      typeof (file as File).name === "string" ? (file as File).name : "lista.xlsx";
    const lower = filename.toLowerCase();
    if (
      !/\.(xlsx|xls|csv|tsv|txt)$/i.test(lower) &&
      !(file.type || "").includes("sheet") &&
      !(file.type || "").includes("excel") &&
      !(file.type || "").includes("csv")
    ) {
      return jsonWithCors(
        request,
        { error: "Csak Excel fájl (.xlsx / .xls) támogatott." },
        { status: 415 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcelBuffer(buf);
    if (!parsed.length) {
      return jsonWithCors(
        request,
        {
          error:
            "Nincs beolvasható sor. Használd a sablont: A oszlop = cikkszám, B = mennyiség.",
        },
        { status: 400 },
      );
    }
    return jsonWithCors(request, {
      documentKind: "spreadsheet_like",
      model: "excel",
      warnings: [],
      lines: parsed.map((p) => ({
        rawText: p.rawText,
        codeHint: p.sku,
        quantity: p.quantity,
        confidence: 0.95,
        quantityUncertain: false,
        notes: null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse-excel failed";
    return jsonWithCors(request, { error: msg }, { status: 500 });
  }
}
