import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { withPlatformAdmin } from "@/lib/db";
import { purgeShopCatalog } from "@/lib/orgs/ops";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  let confirmName = "";
  try {
    const body = (await req.json()) as { confirmName?: string };
    confirmName = body.confirmName ?? "";
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin((client) =>
      purgeShopCatalog(client, id, auth.userId, confirmName),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/orgs/:id/purge]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
