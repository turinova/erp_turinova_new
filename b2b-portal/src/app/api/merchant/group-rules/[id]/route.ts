import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import {
  deleteGroupRule,
  updateGroupRule,
  type GroupRuleMetric,
  type GroupRulePeriod,
} from "@/lib/merchant/group-rules";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

type Ctx = { params: Promise<{ id: string }> };

function parsePeriod(raw: unknown): GroupRulePeriod | undefined {
  if (
    raw === "lifetime" ||
    raw === "rolling_12m" ||
    raw === "calendar_year" ||
    raw === "custom"
  ) {
    return raw;
  }
  return undefined;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: ruleId } = await ctx.params;
  if (!ruleId) {
    return NextResponse.json({ error: "Hiányzó szabály" }, { status: 400 });
  }

  let body: {
    name?: string;
    enabled?: boolean;
    metric?: string;
    threshold?: number;
    keepThreshold?: number | null;
    period?: string;
    periodFrom?: string | null;
    periodTo?: string | null;
    fromGroupInnerIds?: number[];
    toGroupInnerId?: number;
    priority?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    await ensurePartnerGroupRulesSchema();
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");

        let toOuter: string | null | undefined;
        let toName: string | null | undefined;
        if (body.toGroupInnerId != null) {
          const groups = await listCustomerGroups(loaded.config);
          const target = groups.find(
            (g) => g.innerId === Number(body.toGroupInnerId),
          );
          if (!target) throw new Error("UNKNOWN_GROUP");
          toOuter = target.id;
          toName = target.name;
        }

        const rule = await updateGroupRule(client, loaded.shopId, ruleId, {
          name: body.name,
          enabled: body.enabled,
          metric: body.metric as GroupRuleMetric | undefined,
          threshold:
            body.threshold != null ? Number(body.threshold) : undefined,
          keepThreshold:
            body.keepThreshold !== undefined
              ? body.keepThreshold == null
                ? null
                : Number(body.keepThreshold)
              : undefined,
          period: parsePeriod(body.period),
          periodFrom:
            body.periodFrom !== undefined ? body.periodFrom : undefined,
          periodTo: body.periodTo !== undefined ? body.periodTo : undefined,
          fromGroupInnerIds: body.fromGroupInnerIds,
          toGroupInnerId:
            body.toGroupInnerId != null
              ? Number(body.toGroupInnerId)
              : undefined,
          toGroupOuterId: toOuter,
          toGroupName: toName,
          priority: body.priority,
        });
        if (!rule) throw new Error("NOT_FOUND");
        return { rule };
      },
    );

    return NextResponse.json({ ok: true, ...result, message: "Frissítve." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Nincs ilyen szabály" }, { status: 404 });
    }
    if (msg === "UNKNOWN_GROUP") {
      return NextResponse.json(
        { error: "Ismeretlen cél csoport" },
        { status: 400 },
      );
    }
    console.error("[PATCH merchant/group-rules/:id]", err);
    return NextResponse.json(
      { error: msg || "Frissítés sikertelen" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: ruleId } = await ctx.params;
  try {
    await ensurePartnerGroupRulesSchema();
    const ok = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");
        return deleteGroupRule(client, loaded.shopId, ruleId);
      },
    );
    if (!ok) {
      return NextResponse.json({ error: "Nincs ilyen szabály" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Törölve." });
  } catch (err) {
    console.error("[DELETE merchant/group-rules/:id]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Törlés sikertelen",
      },
      { status: 500 },
    );
  }
}
