import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import {
  createGroupRule,
  getShopGroupRulesPolicy,
  listGroupRules,
  setShopGroupRulesPolicy,
  type GroupRuleMetric,
  type GroupRulePeriod,
  type ShopGroupRulesPolicy,
} from "@/lib/merchant/group-rules";
import {
  getShopGroupRulesAuto,
  setShopGroupRulesAuto,
  setShopGroupRulesSchedule,
  type GroupRulesSchedule,
} from "@/lib/merchant/group-rules-auto";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { listRecentSystemGroupMoves } from "@/lib/merchant/shop-customers";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

function parsePeriod(raw: unknown): GroupRulePeriod | null {
  if (
    raw === "lifetime" ||
    raw === "rolling_12m" ||
    raw === "calendar_year" ||
    raw === "custom"
  ) {
    return raw;
  }
  return null;
}

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

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
        if (!loaded) return { error: "NO_SHOP_OR_CREDS" as const };

        const [rules, groups, recentMoves, auto, policy] = await Promise.all([
          listGroupRules(client, loaded.shopId),
          listCustomerGroups(loaded.config),
          listRecentSystemGroupMoves(client, loaded.shopId, 40).catch(() => []),
          getShopGroupRulesAuto(client, loaded.shopId),
          getShopGroupRulesPolicy(client, loaded.shopId),
        ]);

        return {
          shopId: loaded.shopId,
          schedule: auto.schedule,
          autoEnabled: auto.autoEnabled,
          autoLastRunAt: auto.lastRunAt,
          policy,
          rules,
          groups: groups.map((g) => ({
            innerId: g.innerId,
            groupId: g.id,
            name: g.name,
            isDefault: g.isDefault,
            percentDiscount: g.percentDiscount,
          })),
          recentMoves: recentMoves.map((m) => ({
            id: m.id,
            customerInnerId: m.sr_customer_inner_id,
            email: m.email_snapshot,
            fromGroupName: m.from_group_name,
            toGroupName: m.to_group_name,
            reason: m.reason,
            source: m.source ?? "manual",
            metric: m.metric ?? null,
            metricValue:
              m.metric_value != null ? Number(m.metric_value) : null,
            threshold: m.threshold != null ? Number(m.threshold) : null,
            period: m.period ?? null,
            direction: m.direction ?? null,
            createdAt: m.created_at,
          })),
        };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[GET merchant/group-rules]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Szabályok betöltése sikertelen",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    name?: string;
    metric?: string;
    threshold?: number;
    keepThreshold?: number | null;
    period?: string;
    periodFrom?: string | null;
    periodTo?: string | null;
    fromGroupInnerIds?: number[];
    toGroupInnerId?: number;
    enabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const metric = body.metric as GroupRuleMetric;
  if (metric !== "lifetime_spent" && metric !== "order_count") {
    return NextResponse.json(
      { error: "Válassz: összes költés vagy rendelésszám." },
      { status: 400 },
    );
  }
  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold < 0) {
    return NextResponse.json({ error: "Érvénytelen küszöb" }, { status: 400 });
  }
  const toGroupInnerId = Number(body.toGroupInnerId);
  if (!Number.isFinite(toGroupInnerId)) {
    return NextResponse.json(
      { error: "Válaszd ki a cél csoportot." },
      { status: 400 },
    );
  }
  const period = parsePeriod(body.period) ?? "lifetime";
  if (period === "custom" && !body.periodFrom) {
    return NextResponse.json(
      { error: "Saját időszaknál add meg a kezdő dátumot." },
      { status: 400 },
    );
  }
  let keepThreshold: number | null | undefined = undefined;
  if (body.keepThreshold != null && body.keepThreshold !== ("" as unknown)) {
    const k = Number(body.keepThreshold);
    if (!Number.isFinite(k) || k < 0) {
      return NextResponse.json(
        { error: "Érvénytelen megtartó küszöb" },
        { status: 400 },
      );
    }
    keepThreshold = k;
  } else if (body.keepThreshold === null) {
    keepThreshold = null;
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

        const groups = await listCustomerGroups(loaded.config);
        const target = groups.find((g) => g.innerId === toGroupInnerId);
        if (!target) throw new Error("UNKNOWN_GROUP");

        const fromIds = Array.isArray(body.fromGroupInnerIds)
          ? body.fromGroupInnerIds.map(Number).filter((n) => Number.isFinite(n))
          : [];

        const rule = await createGroupRule(client, {
          shopId: loaded.shopId,
          name: (body.name || "").trim() || "Szintlépés",
          metric,
          threshold,
          keepThreshold: keepThreshold ?? null,
          period,
          periodFrom: body.periodFrom ?? null,
          periodTo: body.periodTo ?? null,
          fromGroupInnerIds: fromIds,
          toGroupInnerId,
          toGroupOuterId: target.id,
          toGroupName: target.name,
          enabled: body.enabled !== false,
        });

        return { rule };
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      message: "Szabály mentve.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    if (msg === "UNKNOWN_GROUP") {
      return NextResponse.json(
        { error: "Ismeretlen cél csoport" },
        { status: 400 },
      );
    }
    console.error("[POST merchant/group-rules]", err);
    return NextResponse.json(
      { error: msg || "Mentés sikertelen" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    autoEnabled?: boolean;
    schedule?: string;
    policy?: Partial<ShopGroupRulesPolicy>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const scheduleRaw = body.schedule;
  const hasSchedule =
    scheduleRaw === "manual" ||
    scheduleRaw === "daily" ||
    scheduleRaw === "on_order" ||
    scheduleRaw === "hourly";

  if (
    typeof body.autoEnabled !== "boolean" &&
    !hasSchedule &&
    !body.policy
  ) {
    return NextResponse.json(
      { error: "Adj meg schedule, autoEnabled vagy policy mezőt." },
      { status: 400 },
    );
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

        let auto = await getShopGroupRulesAuto(client, loaded.shopId);
        if (hasSchedule) {
          auto = await setShopGroupRulesSchedule(
            client,
            loaded.shopId,
            scheduleRaw as GroupRulesSchedule,
          );
        } else if (typeof body.autoEnabled === "boolean") {
          auto = await setShopGroupRulesAuto(
            client,
            loaded.shopId,
            body.autoEnabled,
          );
        }

        let policy = await getShopGroupRulesPolicy(client, loaded.shopId);
        if (body.policy) {
          policy = await setShopGroupRulesPolicy(
            client,
            loaded.shopId,
            body.policy,
          );
        }

        return {
          schedule: auto.schedule,
          autoEnabled: auto.autoEnabled,
          autoLastRunAt: auto.lastRunAt,
          policy,
        };
      },
    );

    const parts: string[] = [];
    if (hasSchedule || typeof body.autoEnabled === "boolean") {
      const labels: Record<string, string> = {
        manual: "Csak kézi futtatás.",
        daily: "Naponta egyszer fog futni.",
        on_order: "Rendelés után ellenőrzi az adott vevőt.",
        hourly: "Kb. óránként fut (kíméletes).",
      };
      parts.push(labels[result.schedule] || "Ütemezés mentve.");
    }
    if (body.policy) parts.push("Beállítások mentve.");

    return NextResponse.json({
      ok: true,
      ...result,
      message: parts.join(" ") || "Mentve.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[PATCH merchant/group-rules]", err);
    return NextResponse.json(
      { error: msg || "Frissítés sikertelen" },
      { status: 500 },
    );
  }
}
