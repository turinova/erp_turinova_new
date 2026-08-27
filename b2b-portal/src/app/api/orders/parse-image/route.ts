import {
  detectImageMediaType,
  parseOrderImage,
} from "@/lib/parse-order";
import { jsonWithCors, optionsCors } from "@/lib/cors";
import { canParseImage, parsePlanId } from "@/lib/billing/plans";
import { withPlatformAdmin, query } from "@/lib/db";
import { isTrialActive } from "@/lib/orgs/health";
import { extractShopPublicId } from "@/lib/shoprenter/resolve-shop";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

async function shopAllowsPhoto(request: Request): Promise<boolean> {
  const publicId = extractShopPublicId(request);
  if (!publicId) return false;
  return withPlatformAdmin(async (client) => {
    const res = await query<{
      plan: string;
      status: string;
      trial_ends_at: Date | string | null;
    }>(
      client,
      `select o.plan, o.status, o.trial_ends_at
       from shops s
       join organizations o on o.id = s.organization_id
       where s.public_id = $1
       limit 1`,
      [publicId],
    );
    const row = res.rows[0];
    if (!row) return false;
    const plan = parsePlanId(row.plan);
    const trial = isTrialActive(
      row.status,
      row.trial_ends_at instanceof Date
        ? row.trial_ends_at.toISOString()
        : row.trial_ends_at,
    );
    return canParseImage(plan, trial);
  });
}

export async function POST(request: Request) {
  try {
    const allowed = await shopAllowsPhoto(request);
    if (!allowed) {
      return jsonWithCors(
        request,
        { error: "A fotós lista ezen a bolton nem elérhető." },
        { status: 403 },
      );
    }
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
            "PDF egyelőre nem támogatott. Készíts egy oldalas JPG/PNG fotót a listáról.",
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
