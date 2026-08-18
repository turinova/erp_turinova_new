import {
  detectImageMediaType,
  parseOrderImage,
} from "@/lib/parse-order";
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
    if (file.size > 10 * 1024 * 1024) {
      return jsonWithCors(
        request,
        { error: "Max fájlméret 10 MB" },
        { status: 400 },
      );
    }
    const filename =
      typeof (file as File).name === "string" ? (file as File).name : "upload.jpg";
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) {
      return jsonWithCors(
        request,
        {
          error:
            "PDF egyelőre nem támogatott — készíts egy oldalas JPG/PNG fotót a listáról.",
        },
        { status: 415 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mediaType = detectImageMediaType(file.type, filename);
    const result = await parseOrderImage({
      base64: buf.toString("base64"),
      mediaType,
    });
    return jsonWithCors(request, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse-image failed";
    const status = /ANTHROPIC_API_KEY/i.test(msg) ? 503 : 500;
    return jsonWithCors(request, { error: msg }, { status });
  }
}
