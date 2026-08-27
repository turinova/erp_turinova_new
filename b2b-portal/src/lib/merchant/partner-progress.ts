/**
 * Partner next-level progress (FOMO) — shared by widget + merchant preview.
 * Uses the same ladder + rules as automatizmus evaluation.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import {
  getShopGroupRulesPolicy,
  listGroupRules,
  periodBounds,
  computeCustomerOrderMetrics,
  type GroupRewardCopy,
  type GroupRuleDto,
  type GroupRuleMetric,
  type GroupRulePeriod,
  type ShopGroupRulesPolicy,
} from "@/lib/merchant/group-rules";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  getCustomerByInnerId,
  listCustomerGroups,
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type PartnerProgressUrgency = "low" | "mid" | "high" | "done";

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
  /** Absolute gap without "Még" — e.g. "184 200 Ft" / "2 rendelés". */
  remainingLabel: string | null;
  nextGroupName: string | null;
  nextGroupInnerId: number | null;
  atTop: boolean;
  progressPercent: number | null;
  /**
   * Hero / status line for legacy + fallback.
   * Prefer remainingLabel + nextGroupName in the widget UI.
   */
  label: string | null;
  /** e.g. "2 / 5 rendelés" — secondary; widget hides from primary FOMO. */
  currentFormatted: string | null;
  /** Concrete current tier — only if % > 0. */
  currentBenefitLabel: string | null;
  /** @deprecated use rewardHeadline */
  nextBenefitLabel: string | null;
  /** Concrete unlock — e.g. "−12% nettó". Null = hide reward row. */
  rewardHeadline: string | null;
  /** One-liner under headline. */
  rewardDetail: string | null;
  urgency: PartnerProgressUrgency | null;
};

function percentLabel(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null;
  return `−${Math.round(pct)}% nettó`;
}

async function countGroupFixPrices(
  client: PoolClient,
  shopId: string,
  groupOuterId: string | null | undefined,
): Promise<number> {
  if (!groupOuterId) return 0;
  try {
    const res = await query<{ n: string }>(
      client,
      `select count(*)::text as n
       from partner_group_prices
       where shop_id = $1 and customer_group_outer_id = $2`,
      [shopId, groupOuterId],
    );
    return Math.max(0, parseInt(res.rows[0]?.n || "0", 10) || 0);
  } catch {
    return 0;
  }
}

/**
 * Resolve concrete FOMO reward. Never returns vague "kedvezőbb…" copy.
 * Priority: merchant manual → % discount → fix group prices → null.
 */
async function resolveNextReward(opts: {
  client: PoolClient;
  shopId: string;
  policy: ShopGroupRulesPolicy;
  currentGroup: SrCustomerGroup | null | undefined;
  nextGroup: SrCustomerGroup | null | undefined;
  nextInnerId: number | null;
}): Promise<{
  rewardHeadline: string | null;
  rewardDetail: string | null;
  currentBenefitLabel: string | null;
  nextBenefitLabel: string | null;
}> {
  const currentBenefitLabel = percentLabel(
    opts.currentGroup?.percentDiscount,
  );
  const nextId = opts.nextInnerId;
  if (nextId == null) {
    return {
      rewardHeadline: null,
      rewardDetail: null,
      currentBenefitLabel,
      nextBenefitLabel: null,
    };
  }

  const manual: GroupRewardCopy | undefined =
    opts.policy.rewards[String(nextId)];
  if (manual?.headline) {
    return {
      rewardHeadline: manual.headline,
      rewardDetail: manual.detail,
      currentBenefitLabel,
      nextBenefitLabel: manual.headline,
    };
  }

  const nextPct = opts.nextGroup?.percentDiscount ?? null;
  const nextPctLabel = percentLabel(nextPct);
  if (nextPctLabel) {
    const curPct = opts.currentGroup?.percentDiscount ?? 0;
    const detail =
      curPct > 0 && nextPct != null && nextPct > curPct
        ? `most −${Math.round(curPct)}% → következő ${nextPctLabel}`
        : "Az árlistás termékekre";
    return {
      rewardHeadline: nextPctLabel,
      rewardDetail: detail,
      currentBenefitLabel,
      nextBenefitLabel: nextPctLabel,
    };
  }

  const n = await countGroupFixPrices(
    opts.client,
    opts.shopId,
    opts.nextGroup?.id,
  );
  if (n > 0) {
    const name = opts.nextGroup?.name || "partner";
    const headline = "Egyedi partnerárak";
    const detail = `${n.toLocaleString("hu-HU")} termék ${name} áron`;
    return {
      rewardHeadline: headline,
      rewardDetail: detail,
      currentBenefitLabel,
      nextBenefitLabel: headline,
    };
  }

  return {
    rewardHeadline: null,
    rewardDetail: null,
    currentBenefitLabel,
    nextBenefitLabel: null,
  };
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

function formatCurrentVsThreshold(
  metric: GroupRuleMetric,
  current: number,
  threshold: number,
): string {
  if (metric === "order_count") {
    return `${Math.round(current)} / ${Math.round(threshold)} rendelés`;
  }
  return `${Math.round(current).toLocaleString("hu-HU")} / ${Math.round(threshold).toLocaleString("hu-HU")} Ft`;
}

function urgencyFromPercent(
  pct: number | null,
  atTop: boolean,
  remaining: number | null,
): PartnerProgressUrgency | null {
  if (atTop || (remaining != null && remaining <= 0)) return "done";
  if (pct == null) return null;
  if (pct >= 70) return "high";
  if (pct >= 35) return "mid";
  return "low";
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
    remainingLabel: null,
    nextGroupName: null,
    nextGroupInnerId: null,
    atTop: false,
    progressPercent: null,
    label: null,
    currentFormatted: null,
    currentBenefitLabel: null,
    nextBenefitLabel: null,
    rewardHeadline: null,
    rewardDetail: null,
    urgency: null,
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
      label: null,
    };
  }

  const rules = (await listGroupRules(opts.client, opts.shopId)).filter(
    (r) => r.enabled,
  );
  /* No rules configured → never show FOMO progress (group name chip OK). */
  if (rules.length === 0) {
    return {
      ...base,
      showProgress: false,
      label: null,
    };
  }

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

  const curGroup =
    customer.groupInnerId != null
      ? groups.find((g) => g.innerId === customer.groupInnerId)
      : null;

  if (betterTargets.length === 0 && curRank >= 0) {
    /* Top of ladder — nothing to unlock; hide progress bar. */
    return {
      ...base,
      showProgress: false,
      atTop: true,
      label: null,
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
      m = await computeCustomerOrderMetrics(
        opts.config,
        customer.innerId,
        b,
        policy,
        { maxPagesLifetime: 4, maxPagesWindowed: 6, sleepMs: 200 },
      );
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
    /* Rules exist but none apply to this customer's group → hide progress. */
    return {
      ...base,
      showProgress: false,
      atTop: betterTargets.length === 0 && curRank >= 0,
      label: null,
    };
  }

  const floor = 0;
  const span = Math.max(1, best.rule.threshold - floor);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((best.value - floor) / span) * 100)),
  );
  const remLabel = formatRemaining(best.rule.metric, best.remaining);
  const nextGroup =
    groups.find((g) => g.innerId === best.rule.toGroupInnerId) ?? null;
  const reward = await resolveNextReward({
    client: opts.client,
    shopId: opts.shopId,
    policy,
    currentGroup: curGroup,
    nextGroup,
    nextInnerId: best.rule.toGroupInnerId,
  });
  const label =
    best.remaining <= 0
      ? `Elérted: ${best.toName}`
      : `Még ${remLabel} → ${best.toName}`;

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
    remainingLabel: best.remaining <= 0 ? null : remLabel,
    nextGroupName: best.toName,
    nextGroupInnerId: best.rule.toGroupInnerId,
    atTop: false,
    progressPercent: pct,
    label,
    currentFormatted: formatCurrentVsThreshold(
      best.rule.metric,
      best.value,
      best.rule.threshold,
    ),
    currentBenefitLabel: reward.currentBenefitLabel,
    nextBenefitLabel: reward.nextBenefitLabel,
    rewardHeadline: reward.rewardHeadline,
    rewardDetail: reward.rewardDetail,
    urgency: urgencyFromPercent(pct, false, best.remaining),
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
