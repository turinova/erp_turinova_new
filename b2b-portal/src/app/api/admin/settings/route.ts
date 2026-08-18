import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { PLAN_DEFAULTS, PLAN_IDS, TRIAL_DAYS_DEFAULT, isPlanId, parsePlanId, type PlanId } from "@/lib/billing/plans";
import { withPlatformAdmin, query } from "@/lib/db";
import { insertAudit } from "@/lib/orgs/ops";

export type PlanDefaultRow = {
  plan: PlanId;
  partnerLimit: number;
  skuLimit: number;
  listPriceHuf: number;
};

export type PlatformSettingsDto = {
  trialDays: number;
  syncConcurrency: number;
  portalTopNGate: boolean;
  plans: PlanDefaultRow[];
};

async function loadSettings(client: Parameters<typeof query>[0]): Promise<PlatformSettingsDto> {
  const plansRes = await query<{
    plan: string;
    partner_limit: number;
    sku_limit: number;
    list_price_huf: number;
  }>(client, `select plan, partner_limit, sku_limit, list_price_huf from plan_defaults`);

  const plans: PlanDefaultRow[] = PLAN_IDS.map((id) => {
    const row = plansRes.rows.find((r) => parsePlanId(r.plan) === id);
    const fallback = PLAN_DEFAULTS[id];
    return {
      plan: id,
      partnerLimit: Number(row?.partner_limit ?? fallback.partnerLimit),
      skuLimit: Number(row?.sku_limit ?? fallback.skuLimit),
      listPriceHuf: Number(row?.list_price_huf ?? fallback.listPriceHuf),
    };
  });

  let trialDays = TRIAL_DAYS_DEFAULT;
  let syncConcurrency = 10;
  let portalTopNGate = true;
  const hasSettings = await query<{ t: string | null }>(
    client,
    `select to_regclass('public.platform_settings')::text as t`,
  );
  if (hasSettings.rows[0]?.t) {
    const s = await query<{
      trial_days: number;
      sync_concurrency: number;
      portal_top_n_gate: boolean;
    }>(client, `select trial_days, sync_concurrency, portal_top_n_gate from platform_settings where id = 1`);
    if (s.rows[0]) {
      trialDays = Number(s.rows[0].trial_days);
      syncConcurrency = Number(s.rows[0].sync_concurrency);
      portalTopNGate = Boolean(s.rows[0].portal_top_n_gate);
    }
  }

  return { trialDays, syncConcurrency, portalTopNGate, plans };
}

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;
  try {
    const settings = await withPlatformAdmin((client) => loadSettings(client));
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("[GET /api/admin/settings]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

type PatchBody = {
  trialDays?: number;
  syncConcurrency?: number;
  portalTopNGate?: boolean;
  plans?: Array<{
    plan?: string;
    partnerLimit?: number;
    skuLimit?: number;
    listPriceHuf?: number;
  }>;
};

export async function PATCH(req: Request) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    const settings = await withPlatformAdmin(async (client) => {
      if (body.plans) {
        for (const p of body.plans) {
          if (!p.plan || !isPlanId(p.plan)) continue;
          const partner = Math.max(1, Number(p.partnerLimit) || 1);
          const sku = Math.max(1, Number(p.skuLimit) || 1);
          const price = Math.max(0, Number(p.listPriceHuf) || 0);
          await query(
            client,
            `insert into plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
             values ($1, $2, $3, $4)
             on conflict (plan) do update set
               partner_limit = excluded.partner_limit,
               sku_limit = excluded.sku_limit,
               list_price_huf = excluded.list_price_huf,
               updated_at = now()`,
            [p.plan, partner, sku, price],
          );
        }
      }

      const trialDays = Math.min(90, Math.max(1, Number(body.trialDays) || TRIAL_DAYS_DEFAULT));
      const syncConcurrency = Math.min(50, Math.max(1, Number(body.syncConcurrency) || 10));
      const portalTopNGate = body.portalTopNGate !== false;
      const hasSettings = await query<{ t: string | null }>(
        client,
        `select to_regclass('public.platform_settings')::text as t`,
      );
      if (hasSettings.rows[0]?.t) {
        await query(
          client,
          `insert into platform_settings (id, trial_days, sync_concurrency, portal_top_n_gate, updated_at)
           values (1, $1, $2, $3, now())
           on conflict (id) do update set
             trial_days = excluded.trial_days,
             sync_concurrency = excluded.sync_concurrency,
             portal_top_n_gate = excluded.portal_top_n_gate,
             updated_at = now()`,
          [trialDays, syncConcurrency, portalTopNGate],
        );
      }

      await insertAudit(client, {
        organizationId: null,
        actorUserId: auth.userId,
        action: "platform.settings_updated",
        meta: { trialDays, syncConcurrency, portalTopNGate },
      });

      return loadSettings(client);
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("[PATCH /api/admin/settings]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
