import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { enqueueFullSync } from "@/lib/commerce/jobs";
import { kickCatalogSync } from "@/lib/commerce/loop";
import { withPlatformAdmin, query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id: orgId } = await ctx.params;
  try {
    const result = await withPlatformAdmin(async (client) => {
      const shop = await query<{ id: string; status: string }>(
        client,
        `select id, status from shops
         where organization_id = $1 and purged_at is null
         order by created_at limit 1`,
        [orgId],
      );
      const row = shop.rows[0];
      if (!row) return { error: "NO_SHOP" as const };
      const enq = await enqueueFullSync(client, row.id, orgId);
      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'catalog.sync_forced', $3::jsonb)`,
        [orgId, auth.userId, JSON.stringify({ jobId: enq.jobId, shopId: row.id })],
      );
      return { jobId: enq.jobId, created: enq.created, shopId: row.id };
    });

    if ("error" in result) {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    kickCatalogSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/admin/orgs/:id/sync]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
