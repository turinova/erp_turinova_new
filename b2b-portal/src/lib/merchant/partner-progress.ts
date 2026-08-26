/**
 * Partner next-level progress (FOMO) — shared by widget + merchant preview.
 * Uses the same ladder + rules as szintlépés evaluation.
 */

import type { PoolClient } from "pg";
import {
  getShopGroupRulesPolicy,
  listGroupRules,
  periodBounds,
  type GroupRuleDto,
  type GroupRuleMetric,
  type GroupRulePeriod,
} from "@/lib/merchant/group-rules";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  listCustomerOrders,
  type CustomerOrderSummary,
} from "@/lib/shoprenter/api";
import {
  getCustomerByInnerId,
  listCustomerGroups,
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type PartnerProgressDto = {
  groupInnerId: number | null;
  groupName: string | null;
  showGroupName: boolean;
  showProgress: boolean;
  metric: GroupRuleMetric | null;
  period: GroupRulePeriod | null;
  current: number;
  nextThreshold: number | null;
  remaining: number | null;
  nextGroupName: string | null;
  nextGroupInnerId: number | null;
  atTop: boolean;
  progressPercent: number | null;
  label: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function orderLooksCancelled(o: CustomerOrderSummary): boolean {
  const s = (o.status || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("storn") ||
    s.includes("cancel") ||
    s.includes("töröl") ||
    s.includes("torol") ||
    s.includes("refund") ||
    s.includes("visszatér")
  );
}

async function metricInWindow(
  config: ShoprenterConfig,
  customerInnerId: number,
  bounds: { fromMs: number | null; toMs: number | null },
): Promise<{ spent: number; orderCount: number }> {
  const maxPages = bounds.fromMs == null ? 4 : 6;
  let spent = 0;
  let orderCount = 0;
  let hitOlder = false;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(200);
    const { orders, pageCount } = await listCustomerOrders(
      config,
      customerInnerId,
      { limit: 50, page },
    );
    if (!orders.length) break;
    for (const o of orders) {
      if (orderLooksCancelled(o)) continue;
      const t = Date.parse(o.dateCreated) || 0;
      if (bounds.fromMs != null && t && t < bounds.fromMs) {
        hitOlder = true;
        continue;
      }
      if (bounds.toMs != null && t && t > bounds.toMs) continue;
      if (bounds.fromMs != null && t && t < bounds.fromMs) continue;
      spent += o.total ?? o.totalGross ?? 0;
      orderCount += 1;
    }
    if (hitOlder && bounds.fromMs != null) break;
    if (page + 1 >= pageCount) break;
  }
  return { spent: Math.round(spent), orderCount };
}

function ladderRank(ladder: number[], groupInnerId: number | null): number {
  if (groupInnerId == null) return -1;
  if (ladder.length === 0) return groupInnerId;
  const idx = ladder.indexOf(groupInnerId);
  return idx >= 0 ? idx : -1;
}

function formatRemaining(metric: GroupRuleMetric, n: number): string {
  if (metric === "order_count") {
    const k = Math.max(0, Math.ceil(n));
    return k === 1 ? "1 rendelés" : `${k} rendelés`;
  }
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

export async function getPartnerProgress(opts: {
  client: PoolClient;
  config: ShoprenterConfig;
  shopId: string;
  customerInnerId: number;
  showGroupName: boolean;
  showProgress: boolean;
  customer?: SrCustomer | null;
  groups?: SrCustomerGroup[];
}): Promise<PartnerProgressDto> {
  const empty: PartnerProgressDto = {
    groupInnerId: null,
    groupName: null,
    showGroupName: opts.showGroupName,
    showProgress: false,
    metric: null,
    period: null,
    current: 0,
    nextThreshold: null,
    remaining: null,
    nextGroupName: null,
    nextGroupInnerId: null,
    atTop: false,
    progressPercent: null,
    label: null,
  };

  const groups =
    opts.groups ?? (await listCustomerGroups(opts.config));
  const customer =
    opts.customer ??
    (await getCustomerByInnerId(opts.config, opts.customerInnerId, {
      groups,
    }));
  if (!customer) return empty;

  const base: PartnerProgressDto = {
    ...empty,
    groupInnerId: customer.groupInnerId,
    groupName: customer.groupName,
    showGroupName: opts.showGroupName,
  };

  if (!opts.showProgress) {
    return {
      ...base,
      label: opts.showGroupName && customer.groupName
        ? `Csoportod: ${customer.groupName}`
        : null,
    };
  }

  const rules = (await listGroupRules(opts.client, opts.shopId)).filter(
    (r) => r.enabled,
  );
  const policy = await getShopGroupRulesPolicy(opts.client, opts.shopId);
  const ladder =
    policy.ladder.length > 0
      ? policy.ladder
      : [
          ...groups.filter((g) => g.isDefault).map((g) => g.innerId),
          ...groups.filter((g) => !g.isDefault).map((g) => g.innerId),
        ];

  const curRank = ladderRank(ladder, customer.groupInnerId);
  const betterTargets = ladder.filter((_, i) => i > curRank);

  if (betterTargets.length === 0 && curRank >= 0) {
    return {
      ...base,
      showProgress: true,
      atTop: true,
      label: customer.groupName
        ? `Legjobb csoportod: ${customer.groupName}`
        : "Legjobb csoportod van.",
    };
  }

  /* Find closest upgrade among rules targeting a better ladder group */
  type Cand = {
    rule: GroupRuleDto;
    value: number;
    remaining: number;
    toName: string;
  };
  let best: Cand | null = null;
  const metricsCache = new Map<string, { spent: number; orderCount: number }>();

  for (const rule of rules) {
    const toRank = ladderRank(ladder, rule.toGroupInnerId);
    if (toRank <= curRank) continue;
    if (customer.groupInnerId === rule.toGroupInnerId) continue;
    if (rule.fromGroupInnerIds.length > 0) {
      if (
        customer.groupInnerId == null ||
        !rule.fromGroupInnerIds.includes(customer.groupInnerId)
      ) {
        continue;
      }
    }

    const b = periodBounds(rule);
    const key = `${rule.period}:${b.fromMs ?? ""}:${b.toMs ?? ""}`;
    let m = metricsCache.get(key);
    if (!m) {
      m = await metricInWindow(opts.config, customer.innerId, b);
      metricsCache.set(key, m);
    }
    const value =
      rule.metric === "order_count" ? m.orderCount : m.spent;
    const remaining = Math.max(0, rule.threshold - value);
    const toName =
      groups.find((g) => g.innerId === rule.toGroupInnerId)?.name ||
      rule.toGroupName ||
      `Csoport ${rule.toGroupInnerId}`;

    if (
      !best ||
      remaining < best.remaining ||
      (remaining === best.remaining &&
        toRank > ladderRank(ladder, best.rule.toGroupInnerId))
    ) {
      best = { rule, value, remaining, toName };
    }
  }

  if (!best) {
    return {
      ...base,
      showProgress: true,
      atTop: betterTargets.length === 0,
      label:
        opts.showGroupName && customer.groupName
          ? `Csoportod: ${customer.groupName}`
          : null,
    };
  }

  const floor = 0;
  const span = Math.max(1, best.rule.threshold - floor);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((best.value - floor) / span) * 100)),
  );
  const remLabel = formatRemaining(best.rule.metric, best.remaining);
  const label =
    best.remaining <= 0
      ? `Elérted a küszöböt: ${best.toName}`
      : `Még ${remLabel} a(z) ${best.toName} csoporthoz`;

  return {
    groupInnerId: customer.groupInnerId,
    groupName: customer.groupName,
    showGroupName: opts.showGroupName,
    showProgress: true,
    metric: best.rule.metric,
    period: best.rule.period,
    current: best.value,
    nextThreshold: best.rule.threshold,
    remaining: best.remaining,
    nextGroupName: best.toName,
    nextGroupInnerId: best.rule.toGroupInnerId,
    atTop: false,
    progressPercent: pct,
    label,
  };
}

/** Reconstruct which group an order fell into from move timeline (B1). */
export function groupAtTimeFromMoves(
  movesAsc: Array<{
    created_at: string;
    to_group_inner_id: number;
    to_group_name: string | null;
    from_group_inner_id: number | null;
    from_group_name: string | null;
  }>,
  atMs: number,
  currentGroup: { innerId: number | null; name: string | null },
): { innerId: number | null; name: string | null } {
  if (!movesAsc.length) return currentGroup;
  let group = {
    innerId: movesAsc[0]!.from_group_inner_id,
    name: movesAsc[0]!.from_group_name,
  };
  for (const m of movesAsc) {
    const t = Date.parse(m.created_at) || 0;
    if (t <= atMs) {
      group = { innerId: m.to_group_inner_id, name: m.to_group_name };
    } else break;
  }
  if (group.innerId == null && currentGroup.innerId != null) {
    return currentGroup;
  }
  return group;
}
