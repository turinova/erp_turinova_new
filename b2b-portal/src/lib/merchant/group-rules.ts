/**
 * Partner automatizmus — szabályok + kiértékelés.
 * Időablak, csak-felfelé / visszaléptetés, megtartó küszöb, türelmi idő.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import {
  recordGroupMove,
  upsertShopCustomer,
} from "@/lib/merchant/shop-customers";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  listCustomerOrders,
  orderStatusNameLooksCancelled,
  type CustomerOrderSummary,
} from "@/lib/shoprenter/api";
import {
  listCustomerGroups,
  listRecentCustomers,
  getCustomerByInnerId,
  updateCustomerGroup,
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type GroupRuleMetric = "lifetime_spent" | "order_count";
export type GroupRulePeriod =
  | "lifetime"
  | "rolling_12m"
  | "calendar_year"
  | "custom";

export type GroupRuleDto = {
  id: string;
  shopId: string;
  name: string;
  enabled: boolean;
  metric: GroupRuleMetric;
  threshold: number;
  keepThreshold: number | null;
  period: GroupRulePeriod;
  periodFrom: string | null;
  periodTo: string | null;
  fromGroupInnerIds: number[];
  toGroupInnerId: number;
  toGroupOuterId: string | null;
  toGroupName: string | null;
  priority: number;
};

export type GroupRewardCopy = {
  /** Short, concrete — e.g. "−12% nettó" / "Egyedi partnerárak" */
  headline: string;
  /** Optional one-liner — e.g. "Minden listás termékre" */
  detail: string | null;
};

export type OrderStatusMode = "exclude_cancelled" | "allowlist";

export type ShopGroupRulesPolicy = {
  allowDowngrade: boolean;
  graceDays: number;
  cooldownDays: number;
  /** MM-DD, e.g. "02-01" — before this date in the year, no auto downgrade */
  downgradeAfterMd: string | null;
  /** Worst → best group inner ids */
  ladder: number[];
  /** Per group-inner-id FOMO reward copy for the widget */
  rewards: Record<string, GroupRewardCopy>;
  /**
   * How order statuses count toward spent / order_count.
   * exclude_cancelled (default): all except cancelled/refund-like status names.
   * allowlist: only orderStatusIds count (empty → fall back to exclude_cancelled).
   */
  orderStatusMode: OrderStatusMode;
  /** SR orderStatus resource ids — used when orderStatusMode === 'allowlist' */
  orderStatusIds: string[];
};

function normalizeOrderStatusMode(raw: unknown): OrderStatusMode {
  return raw === "allowlist" ? "allowlist" : "exclude_cancelled";
}

function normalizeOrderStatusIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id.slice(0, 200));
    if (out.length >= 80) break;
  }
  return out;
}

/**
 * Whether an order counts toward automatizmus / FOMO metrics.
 */
export function orderCountsTowardLevelUp(
  o: Pick<CustomerOrderSummary, "status" | "statusId">,
  policy: Pick<ShopGroupRulesPolicy, "orderStatusMode" | "orderStatusIds">,
): boolean {
  const ids = policy.orderStatusIds || [];
  const statusId =
    typeof o.statusId === "string" && o.statusId.trim()
      ? o.statusId.trim()
      : null;

  if (policy.orderStatusMode === "allowlist" && ids.length > 0) {
    if (statusId) return ids.includes(statusId);
    /* No id on order: do not invent membership — exclude cancelled names only */
    return !orderStatusNameLooksCancelled(o.status || "");
  }

  return !orderStatusNameLooksCancelled(o.status || "");
}

function normalizeRewards(raw: unknown): Record<string, GroupRewardCopy> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, GroupRewardCopy> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(k)) continue;
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const headline =
      typeof o.headline === "string" ? o.headline.trim() : "";
    if (!headline) continue;
    const detail =
      typeof o.detail === "string" && o.detail.trim()
        ? o.detail.trim()
        : null;
    out[k] = { headline: headline.slice(0, 80), detail: detail?.slice(0, 160) ?? null };
  }
  return out;
}

export type RuleEvalHit = {
  customerInnerId: number;
  email: string;
  name: string;
  fromGroupInnerId: number | null;
  fromGroupName: string | null;
  toGroupInnerId: number;
  toGroupName: string;
  ruleId: string;
  ruleName: string;
  metric: GroupRuleMetric;
  value: number;
  threshold: number;
  direction: "up" | "down";
  period: GroupRulePeriod;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const BUDAPEST = "Europe/Budapest";

function partsInBudapest(d = new Date()): {
  y: number;
  m: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUDAPEST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-").map(Number);
  return { y: y!, m: m!, day: day! };
}

function startOfCalendarYearMs(): number {
  const { y } = partsInBudapest();
  return Date.parse(`${y}-01-01T00:00:00+01:00`);
}

function rolling12mMs(): number {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.getTime();
}

export function periodBounds(rule: GroupRuleDto): {
  fromMs: number | null;
  toMs: number | null;
} {
  switch (rule.period) {
    case "lifetime":
      return { fromMs: null, toMs: null };
    case "rolling_12m":
      return { fromMs: rolling12mMs(), toMs: null };
    case "calendar_year":
      return { fromMs: startOfCalendarYearMs(), toMs: null };
    case "custom": {
      const fromMs = rule.periodFrom
        ? Date.parse(`${rule.periodFrom}T00:00:00+01:00`)
        : null;
      const toMs = rule.periodTo
        ? Date.parse(`${rule.periodTo}T23:59:59+01:00`)
        : null;
      return {
        fromMs: Number.isFinite(fromMs) ? fromMs : null,
        toMs: Number.isFinite(toMs) ? toMs : null,
      };
    }
    default:
      return { fromMs: null, toMs: null };
  }
}

function orderInWindow(
  o: CustomerOrderSummary,
  fromMs: number | null,
  toMs: number | null,
): boolean {
  const t = Date.parse(o.dateCreated) || 0;
  if (!t) return fromMs == null;
  if (fromMs != null && t < fromMs) return false;
  if (toMs != null && t > toMs) return false;
  return true;
}

type RuleRow = {
  id: string;
  shop_id: string;
  name: string;
  enabled: boolean;
  metric: string;
  threshold: string;
  keep_threshold: string | null;
  period: string;
  period_from: string | null;
  period_to: string | null;
  from_group_inner_ids: number[] | null;
  to_group_inner_id: number;
  to_group_outer_id: string | null;
  to_group_name: string | null;
  priority: number;
};

function mapRule(row: RuleRow): GroupRuleDto {
  const period = (
    ["lifetime", "rolling_12m", "calendar_year", "custom"].includes(row.period)
      ? row.period
      : "lifetime"
  ) as GroupRulePeriod;
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name || "",
    enabled: row.enabled,
    metric: row.metric as GroupRuleMetric,
    threshold: Number(row.threshold),
    keepThreshold:
      row.keep_threshold != null && row.keep_threshold !== ""
        ? Number(row.keep_threshold)
        : null,
    period,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    fromGroupInnerIds: Array.isArray(row.from_group_inner_ids)
      ? row.from_group_inner_ids.map(Number).filter((n) => Number.isFinite(n))
      : [],
    toGroupInnerId: row.to_group_inner_id,
    toGroupOuterId: row.to_group_outer_id,
    toGroupName: row.to_group_name,
    priority: row.priority,
  };
}

const RULE_SELECT = `id, shop_id, name, enabled, metric, threshold::text,
  keep_threshold::text, period, period_from::text, period_to::text,
  from_group_inner_ids, to_group_inner_id, to_group_outer_id,
  to_group_name, priority`;

export async function listGroupRules(
  client: PoolClient,
  shopId: string,
): Promise<GroupRuleDto[]> {
  await ensurePartnerGroupRulesSchema();
  const res = await query<RuleRow>(
    client,
    `select ${RULE_SELECT}
     from partner_group_rules
     where shop_id = $1
     order by priority asc, created_at asc`,
    [shopId],
  );
  return res.rows.map(mapRule);
}

export async function createGroupRule(
  client: PoolClient,
  input: {
    shopId: string;
    name: string;
    metric: GroupRuleMetric;
    threshold: number;
    keepThreshold?: number | null;
    period?: GroupRulePeriod;
    periodFrom?: string | null;
    periodTo?: string | null;
    fromGroupInnerIds: number[];
    toGroupInnerId: number;
    toGroupOuterId: string | null;
    toGroupName: string | null;
    enabled?: boolean;
    priority?: number;
  },
): Promise<GroupRuleDto> {
  await ensurePartnerGroupRulesSchema();
  const period = input.period ?? "lifetime";
  const res = await query<RuleRow>(
    client,
    `insert into partner_group_rules (
       shop_id, name, enabled, metric, threshold, keep_threshold,
       period, period_from, period_to,
       from_group_inner_ids, to_group_inner_id, to_group_outer_id, to_group_name,
       priority
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning ${RULE_SELECT}`,
    [
      input.shopId,
      input.name.trim() || "Automatizmus",
      input.enabled !== false,
      input.metric,
      input.threshold,
      input.keepThreshold ?? null,
      period,
      period === "custom" ? input.periodFrom || null : null,
      period === "custom" ? input.periodTo || null : null,
      input.fromGroupInnerIds,
      input.toGroupInnerId,
      input.toGroupOuterId,
      input.toGroupName,
      input.priority ?? 100,
    ],
  );
  return mapRule(res.rows[0]!);
}

export async function updateGroupRule(
  client: PoolClient,
  shopId: string,
  ruleId: string,
  patch: Partial<{
    name: string;
    enabled: boolean;
    metric: GroupRuleMetric;
    threshold: number;
    keepThreshold: number | null;
    period: GroupRulePeriod;
    periodFrom: string | null;
    periodTo: string | null;
    fromGroupInnerIds: number[];
    toGroupInnerId: number;
    toGroupOuterId: string | null;
    toGroupName: string | null;
    priority: number;
  }>,
): Promise<GroupRuleDto | null> {
  await ensurePartnerGroupRulesSchema();
  const cur = await query<{ id: string }>(
    client,
    `select id from partner_group_rules where shop_id = $1 and id = $2`,
    [shopId, ruleId],
  );
  if (!cur.rows[0]) return null;

  const res = await query<RuleRow>(
    client,
    `update partner_group_rules set
       name = coalesce($3, name),
       enabled = coalesce($4, enabled),
       metric = coalesce($5, metric),
       threshold = coalesce($6, threshold),
       keep_threshold = case
         when $7::boolean then $8::numeric
         else keep_threshold
       end,
       period = coalesce($9, period),
       period_from = case when $10::boolean then $11::date else period_from end,
       period_to = case when $12::boolean then $13::date else period_to end,
       from_group_inner_ids = coalesce($14, from_group_inner_ids),
       to_group_inner_id = coalesce($15, to_group_inner_id),
       to_group_outer_id = coalesce($16, to_group_outer_id),
       to_group_name = coalesce($17, to_group_name),
       priority = coalesce($18, priority),
       updated_at = now()
     where shop_id = $1 and id = $2
     returning ${RULE_SELECT}`,
    [
      shopId,
      ruleId,
      patch.name ?? null,
      patch.enabled ?? null,
      patch.metric ?? null,
      patch.threshold ?? null,
      patch.keepThreshold !== undefined,
      patch.keepThreshold ?? null,
      patch.period ?? null,
      patch.periodFrom !== undefined,
      patch.periodFrom ?? null,
      patch.periodTo !== undefined,
      patch.periodTo ?? null,
      patch.fromGroupInnerIds ?? null,
      patch.toGroupInnerId ?? null,
      patch.toGroupOuterId === undefined ? null : patch.toGroupOuterId,
      patch.toGroupName === undefined ? null : patch.toGroupName,
      patch.priority ?? null,
    ],
  );
  return res.rows[0] ? mapRule(res.rows[0]) : null;
}

export async function deleteGroupRule(
  client: PoolClient,
  shopId: string,
  ruleId: string,
): Promise<boolean> {
  await ensurePartnerGroupRulesSchema();
  const res = await query(
    client,
    `delete from partner_group_rules where shop_id = $1 and id = $2`,
    [shopId, ruleId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getShopGroupRulesPolicy(
  client: PoolClient,
  shopId: string,
): Promise<ShopGroupRulesPolicy> {
  await ensurePartnerGroupRulesSchema();
  const res = await query<{
    group_rules_allow_downgrade: boolean;
    group_rules_grace_days: number;
    group_rules_cooldown_days: number;
    group_rules_downgrade_after_md: string | null;
    group_rules_ladder: number[] | null;
    group_rules_rewards: unknown;
    group_rules_order_status_mode: string | null;
    group_rules_order_status_ids: string[] | null;
  }>(
    client,
    `select group_rules_allow_downgrade,
            group_rules_grace_days,
            group_rules_cooldown_days,
            group_rules_downgrade_after_md,
            group_rules_ladder,
            group_rules_rewards,
            group_rules_order_status_mode,
            group_rules_order_status_ids
     from shops where id = $1`,
    [shopId],
  );
  const row = res.rows[0];
  return {
    allowDowngrade: Boolean(row?.group_rules_allow_downgrade),
    graceDays: Math.max(0, Number(row?.group_rules_grace_days ?? 90)),
    cooldownDays: Math.max(0, Number(row?.group_rules_cooldown_days ?? 0)),
    downgradeAfterMd: row?.group_rules_downgrade_after_md || null,
    ladder: Array.isArray(row?.group_rules_ladder)
      ? row!.group_rules_ladder.map(Number).filter((n) => Number.isFinite(n))
      : [],
    rewards: normalizeRewards(row?.group_rules_rewards),
    orderStatusMode: normalizeOrderStatusMode(
      row?.group_rules_order_status_mode,
    ),
    orderStatusIds: normalizeOrderStatusIds(row?.group_rules_order_status_ids),
  };
}

export async function setShopGroupRulesPolicy(
  client: PoolClient,
  shopId: string,
  patch: Partial<ShopGroupRulesPolicy>,
): Promise<ShopGroupRulesPolicy> {
  await ensurePartnerGroupRulesSchema();
  const cur = await getShopGroupRulesPolicy(client, shopId);
  let orderStatusMode =
    patch.orderStatusMode !== undefined
      ? normalizeOrderStatusMode(patch.orderStatusMode)
      : cur.orderStatusMode;
  let orderStatusIds =
    patch.orderStatusIds !== undefined
      ? normalizeOrderStatusIds(patch.orderStatusIds)
      : cur.orderStatusIds;
  if (orderStatusMode === "allowlist" && orderStatusIds.length === 0) {
    orderStatusMode = "exclude_cancelled";
  }

  const next: ShopGroupRulesPolicy = {
    allowDowngrade: patch.allowDowngrade ?? cur.allowDowngrade,
    graceDays:
      patch.graceDays != null
        ? Math.max(0, Math.min(365, Math.round(patch.graceDays)))
        : cur.graceDays,
    cooldownDays:
      patch.cooldownDays != null
        ? Math.max(0, Math.min(365, Math.round(patch.cooldownDays)))
        : cur.cooldownDays,
    downgradeAfterMd:
      patch.downgradeAfterMd !== undefined
        ? patch.downgradeAfterMd
        : cur.downgradeAfterMd,
    ladder: patch.ladder ?? cur.ladder,
    rewards:
      patch.rewards !== undefined
        ? normalizeRewards(patch.rewards)
        : cur.rewards,
    orderStatusMode,
    orderStatusIds,
  };

  let md: string | null = next.downgradeAfterMd;
  if (md) {
    const m = /^(\d{2})-(\d{2})$/.exec(md.trim());
    md = m ? `${m[1]}-${m[2]}` : null;
  }

  await query(
    client,
    `update shops set
       group_rules_allow_downgrade = $2,
       group_rules_grace_days = $3,
       group_rules_cooldown_days = $4,
       group_rules_downgrade_after_md = $5,
       group_rules_ladder = $6,
       group_rules_rewards = $7::jsonb,
       group_rules_order_status_mode = $8,
       group_rules_order_status_ids = $9,
       updated_at = now()
     where id = $1`,
    [
      shopId,
      next.allowDowngrade,
      next.graceDays,
      next.cooldownDays,
      md,
      next.ladder,
      JSON.stringify(next.rewards),
      next.orderStatusMode,
      next.orderStatusIds,
    ],
  );
  return { ...next, downgradeAfterMd: md };
}

function ladderRank(ladder: number[], groupInnerId: number | null): number {
  if (groupInnerId == null) return -1;
  if (ladder.length === 0) return groupInnerId;
  const idx = ladder.indexOf(groupInnerId);
  return idx >= 0 ? idx : -1;
}

function afterMonthDayReached(md: string | null): boolean {
  if (!md) return true;
  const m = /^(\d{2})-(\d{2})$/.exec(md);
  if (!m) return true;
  const wantM = Number(m[1]);
  const wantD = Number(m[2]);
  const { m: curM, day: curD } = partsInBudapest();
  if (curM > wantM) return true;
  if (curM < wantM) return false;
  return curD >= wantD;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Shared spent / order_count for automatizmus eval + widget FOMO.
 */
export async function computeCustomerOrderMetrics(
  config: ShoprenterConfig,
  customerInnerId: number,
  bounds: { fromMs: number | null; toMs: number | null },
  policy: Pick<ShopGroupRulesPolicy, "orderStatusMode" | "orderStatusIds">,
  opts?: {
    maxPagesLifetime?: number;
    maxPagesWindowed?: number;
    sleepMs?: number;
  },
): Promise<{ spent: number; orderCount: number }> {
  const maxPages =
    bounds.fromMs == null
      ? (opts?.maxPagesLifetime ?? 6)
      : (opts?.maxPagesWindowed ?? 8);
  const sleepMs = opts?.sleepMs ?? 250;
  let spent = 0;
  let orderCount = 0;
  let hitOlderThanWindow = false;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(sleepMs);
    const { orders, pageCount } = await listCustomerOrders(
      config,
      customerInnerId,
      { limit: 50, page },
    );
    if (orders.length === 0) break;

    for (const o of orders) {
      if (!orderCountsTowardLevelUp(o, policy)) continue;
      const t = Date.parse(o.dateCreated) || 0;
      if (bounds.fromMs != null && t && t < bounds.fromMs) {
        hitOlderThanWindow = true;
        continue;
      }
      if (!orderInWindow(o, bounds.fromMs, bounds.toMs)) continue;
      spent += o.total ?? o.totalGross ?? 0;
      orderCount += 1;
    }

    if (hitOlderThanWindow && bounds.fromMs != null) break;
    if (page + 1 >= pageCount) break;
  }

  return { spent: Math.round(spent), orderCount };
}

async function metricForCustomer(
  config: ShoprenterConfig,
  customerInnerId: number,
  bounds: { fromMs: number | null; toMs: number | null },
  policy: Pick<ShopGroupRulesPolicy, "orderStatusMode" | "orderStatusIds">,
): Promise<{ spent: number; orderCount: number }> {
  return computeCustomerOrderMetrics(config, customerInnerId, bounds, policy);
}

function valueFor(
  rule: GroupRuleDto,
  metrics: { spent: number; orderCount: number },
): number {
  return rule.metric === "order_count" ? metrics.orderCount : metrics.spent;
}

function keepOk(rule: GroupRuleDto, value: number): boolean {
  const keep =
    rule.keepThreshold != null && Number.isFinite(rule.keepThreshold)
      ? rule.keepThreshold
      : rule.threshold;
  return value >= keep;
}

function enterOk(rule: GroupRuleDto, value: number): boolean {
  return value >= rule.threshold;
}

function fromMatches(rule: GroupRuleDto, customer: SrCustomer): boolean {
  if (rule.fromGroupInnerIds.length === 0) return true;
  if (customer.groupInnerId == null) return false;
  return rule.fromGroupInnerIds.includes(customer.groupInnerId);
}

/**
 * Candidate inner IDs from shop_customers (+ recent order facts),
 * prioritized by latest order / last_seen — so fresh buyers are evaluated
 * even if they are not in Shoprenter's first "recent" pages.
 */
async function listCandidateInnerIdsFromMirror(
  client: PoolClient,
  shopId: string,
  limit: number,
): Promise<number[]> {
  const cap = Math.min(300, Math.max(10, limit));
  try {
    const res = await query<{ sr_customer_inner_id: number }>(
      client,
      `with recent_orders as (
         select sr_customer_inner_id,
                max(date_created) as last_order_at
           from shop_order_facts
          where shop_id = $1
            and sr_customer_inner_id is not null
            and date_created >= now() - interval '120 days'
          group by sr_customer_inner_id
       )
       select c.sr_customer_inner_id
         from shop_customers c
         left join recent_orders r
           on r.sr_customer_inner_id = c.sr_customer_inner_id
        where c.shop_id = $1
          and c.sr_status = 'active'
          and coalesce(c.skip_auto_group_move, false) = false
        order by coalesce(r.last_order_at, c.last_seen_at) desc nulls last,
                 c.sr_customer_inner_id desc
        limit $2`,
      [shopId, cap],
    );
    return res.rows
      .map((r) => Number(r.sr_customer_inner_id))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch (err) {
    // shop_order_facts or skip column may be missing — simpler query
    try {
      const res = await query<{ sr_customer_inner_id: number }>(
        client,
        `select sr_customer_inner_id
           from shop_customers
          where shop_id = $1
            and sr_status = 'active'
            and coalesce(skip_auto_group_move, false) = false
          order by last_seen_at desc nulls last, sr_customer_inner_id desc
          limit $2`,
        [shopId, cap],
      );
      return res.rows
        .map((r) => Number(r.sr_customer_inner_id))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch (err2) {
      console.warn("[group-rules] listCandidateInnerIdsFromMirror", err2);
      return [];
    }
  }
}

async function hydrateSrCustomers(
  config: ShoprenterConfig,
  innerIds: number[],
  srGroups: SrCustomerGroup[],
  errors: string[],
): Promise<SrCustomer[]> {
  const out: SrCustomer[] = [];
  const seen = new Set<number>();
  const concurrency = 3;

  for (let i = 0; i < innerIds.length; i += concurrency) {
    if (i > 0) await sleep(220);
    const batch = innerIds.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (innerId) => {
        if (seen.has(innerId)) return null;
        seen.add(innerId);
        try {
          return await getCustomerByInnerId(config, innerId, {
            groups: srGroups,
          });
        } catch (e) {
          errors.push(
            `#${innerId}: ${e instanceof Error ? e.message : "vevő hiba"}`,
          );
          return null;
        }
      }),
    );
    for (const c of results) {
      if (c) out.push(c);
    }
  }
  return out;
}

/**
 * Evaluate group rules: DB-first candidates (recent orders / last_seen),
 * SR recent list only as fallback. Return hits (dry) or apply moves.
 */
export async function evaluateGroupRules(opts: {
  client: PoolClient;
  config: ShoprenterConfig;
  shopId: string;
  orgId: string;
  actorUserId: string | null;
  dryRun: boolean;
  maxCustomers?: number;
  /** If set, only these customers (e.g. after an order). */
  onlyCustomerInnerIds?: number[];
}): Promise<{
  scanned: number;
  hits: RuleEvalHit[];
  applied: number;
  skippedLocked: number;
  skippedCooldown: number;
  skippedGrace: number;
  errors: string[];
  candidateSource?: "targeted" | "mirror" | "live";
}> {
  await ensurePartnerGroupRulesSchema();
  const rules = (await listGroupRules(opts.client, opts.shopId)).filter(
    (r) => r.enabled,
  );
  const policy = await getShopGroupRulesPolicy(opts.client, opts.shopId);
  const hits: RuleEvalHit[] = [];
  const errors: string[] = [];
  let applied = 0;
  let skippedLocked = 0;
  let skippedCooldown = 0;
  let skippedGrace = 0;
  let scanned = 0;
  let candidateSource: "targeted" | "mirror" | "live" = "live";

  if (rules.length === 0) {
    return {
      scanned: 0,
      hits,
      applied: 0,
      skippedLocked: 0,
      skippedCooldown: 0,
      skippedGrace: 0,
      errors,
      candidateSource,
    };
  }

  const srGroups = await listCustomerGroups(opts.config);
  const groupByInner = new Map(srGroups.map((g) => [g.innerId, g]));
  const defaultGroup = srGroups.find((g) => g.isDefault) ?? srGroups[0];

  const ladder =
    policy.ladder.length > 0
      ? policy.ladder
      : [
          ...srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
          ...srGroups.filter((g) => !g.isDefault).map((g) => g.innerId),
        ];

  const candidates: SrCustomer[] = [];
  const onlyIds = (opts.onlyCustomerInnerIds || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxCustomers = Math.min(
    200,
    Math.max(20, opts.maxCustomers ?? 120),
  );

  if (onlyIds.length > 0) {
    candidateSource = "targeted";
    const hydrated = await hydrateSrCustomers(
      opts.config,
      [...new Set(onlyIds)].slice(0, 50),
      srGroups,
      errors,
    );
    candidates.push(...hydrated);
  } else {
    const mirrorIds = await listCandidateInnerIdsFromMirror(
      opts.client,
      opts.shopId,
      maxCustomers,
    );
    if (mirrorIds.length > 0) {
      candidateSource = "mirror";
      const hydrated = await hydrateSrCustomers(
        opts.config,
        mirrorIds.slice(0, maxCustomers),
        srGroups,
        errors,
      );
      candidates.push(...hydrated);
    }

    // Fallback / top-up from SR recent if mirror thin
    if (candidates.length < Math.min(25, maxCustomers)) {
      if (mirrorIds.length === 0) candidateSource = "live";
      const seen = new Set(candidates.map((c) => c.innerId));
      for (let page = 0; page < 6 && candidates.length < maxCustomers; page++) {
        if (page > 0) await sleep(350);
        const listed = await listRecentCustomers(opts.config, {
          limit: 25,
          page,
          groups: srGroups,
        });
        for (const c of listed.customers) {
          if (seen.has(c.innerId)) continue;
          seen.add(c.innerId);
          candidates.push(c);
          if (candidates.length >= maxCustomers) break;
        }
        if (page + 1 >= listed.pageCount) break;
      }
    }
  }

  const locked = await query<{
    sr_customer_inner_id: number;
    group_rules_qualified_at: string | null;
  }>(
    opts.client,
    `select sr_customer_inner_id, group_rules_qualified_at::text
     from shop_customers
     where shop_id = $1`,
    [opts.shopId],
  ).catch(
    () =>
      ({
        rows: [] as {
          sr_customer_inner_id: number;
          group_rules_qualified_at: string | null;
        }[],
      }) as const,
  );

  const lockedSet = new Set(
    (
      await query<{ sr_customer_inner_id: number }>(
        opts.client,
        `select sr_customer_inner_id from shop_customers
         where shop_id = $1 and skip_auto_group_move = true`,
        [opts.shopId],
      ).catch(() => ({ rows: [] as { sr_customer_inner_id: number }[] }))
    ).rows.map((r) => r.sr_customer_inner_id),
  );

  const qualifiedAt = new Map<number, Date>();
  for (const r of locked.rows) {
    if (r.group_rules_qualified_at) {
      const d = new Date(r.group_rules_qualified_at);
      if (!Number.isNaN(d.getTime())) {
        qualifiedAt.set(r.sr_customer_inner_id, d);
      }
    }
  }

  const lastMove = await query<{
    sr_customer_inner_id: number;
    created_at: string;
  }>(
    opts.client,
    `select distinct on (sr_customer_inner_id)
       sr_customer_inner_id, created_at::text
     from shop_customer_group_moves
     where shop_id = $1
     order by sr_customer_inner_id, created_at desc`,
    [opts.shopId],
  ).catch(() => ({
    rows: [] as { sr_customer_inner_id: number; created_at: string }[],
  }));
  const lastMoveAt = new Map<number, Date>();
  for (const r of lastMove.rows) {
    const d = new Date(r.created_at);
    if (!Number.isNaN(d.getTime())) lastMoveAt.set(r.sr_customer_inner_id, d);
  }

  const now = new Date();
  const yearStart = new Date(startOfCalendarYearMs());

  for (const customer of candidates) {
    scanned += 1;
    if (lockedSet.has(customer.innerId)) {
      skippedLocked += 1;
      continue;
    }

    const last = lastMoveAt.get(customer.innerId);

    /* Cache metrics per period key */
    const metricsCache = new Map<string, { spent: number; orderCount: number }>();

    async function metricsFor(rule: GroupRuleDto) {
      const b = periodBounds(rule);
      const key = `${rule.period}:${b.fromMs ?? ""}:${b.toMs ?? ""}`;
      let m = metricsCache.get(key);
      if (!m) {
        await sleep(180);
        m = await metricForCustomer(opts.config, customer.innerId, b, policy);
        metricsCache.set(key, m);
      }
      return m;
    }

    try {
      /* --- Upgrade: highest ladder target among matching enter rules --- */
      let bestUp: { rule: GroupRuleDto; value: number } | null = null;
      for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
        if (customer.groupInnerId === rule.toGroupInnerId) continue;
        if (!fromMatches(rule, customer)) continue;
        const metrics = await metricsFor(rule);
        const value = valueFor(rule, metrics);
        if (!enterOk(rule, value)) continue;
        if (!bestUp) {
          bestUp = { rule, value };
          continue;
        }
        const rNew = ladderRank(ladder, rule.toGroupInnerId);
        const rOld = ladderRank(ladder, bestUp.rule.toGroupInnerId);
        if (rNew > rOld) bestUp = { rule, value };
      }

      let planned: {
        rule: GroupRuleDto;
        value: number;
        direction: "up" | "down";
        toInner: number;
      } | null = null;

      if (bestUp) {
        const curRank = ladderRank(ladder, customer.groupInnerId);
        const toRank = ladderRank(ladder, bestUp.rule.toGroupInnerId);
        if (toRank > curRank || curRank < 0) {
          planned = {
            rule: bestUp.rule,
            value: bestUp.value,
            direction: "up",
            toInner: bestUp.rule.toGroupInnerId,
          };
        }
      }

      /* --- Downgrade: only if shop allows --- */
      if (!planned && policy.allowDowngrade && customer.groupInnerId != null) {
        if (
          last &&
          policy.cooldownDays > 0 &&
          daysBetween(last, now) < policy.cooldownDays
        ) {
          skippedCooldown += 1;
        } else if (!afterMonthDayReached(policy.downgradeAfterMd)) {
          skippedGrace += 1;
        } else {
          const holdingRules = rules.filter(
            (r) => r.toGroupInnerId === customer.groupInnerId,
          );
          let stillKeeps = false;
          let worstKeepRule: GroupRuleDto | null = null;
          let keepValue = 0;

          if (holdingRules.length === 0) {
            /* In a partner group with no rule targeting it — don't auto-demote */
            stillKeeps = true;
          } else {
            for (const rule of holdingRules) {
              const metrics = await metricsFor(rule);
              const value = valueFor(rule, metrics);
              if (keepOk(rule, value)) {
                stillKeeps = true;
                break;
              }
              worstKeepRule = rule;
              keepValue = value;
            }
          }

          if (!stillKeeps && worstKeepRule) {
            const qAt = qualifiedAt.get(customer.innerId) ?? last ?? yearStart;
            const graceAnchor =
              worstKeepRule.period === "calendar_year"
                ? new Date(
                    Math.max(yearStart.getTime(), qAt.getTime()),
                  )
                : qAt;
            if (daysBetween(graceAnchor, now) < policy.graceDays) {
              skippedGrace += 1;
            } else {
              const fallTo =
                worstKeepRule.fromGroupInnerIds[0] ??
                defaultGroup?.innerId ??
                null;
              if (fallTo != null && fallTo !== customer.groupInnerId) {
                const curRank = ladderRank(ladder, customer.groupInnerId);
                const toRank = ladderRank(ladder, fallTo);
                if (toRank < curRank || curRank < 0) {
                  planned = {
                    rule: worstKeepRule,
                    value: keepValue,
                    direction: "down",
                    toInner: fallTo,
                  };
                }
              }
            }
          }
        }
      }

      if (!planned) continue;

      const toGroup =
        groupByInner.get(planned.toInner) ??
        ({
          innerId: planned.toInner,
          id: "",
          name: `Csoport ${planned.toInner}`,
        } as SrCustomerGroup);

      const hit: RuleEvalHit = {
        customerInnerId: customer.innerId,
        email: customer.email,
        name:
          [customer.lastname, customer.firstname].filter(Boolean).join(" ") ||
          customer.email,
        fromGroupInnerId: customer.groupInnerId,
        fromGroupName: customer.groupName,
        toGroupInnerId: planned.toInner,
        toGroupName: toGroup.name,
        ruleId: planned.rule.id,
        ruleName: planned.rule.name,
        metric: planned.rule.metric,
        value: planned.value,
        threshold:
          planned.direction === "down"
            ? planned.rule.keepThreshold ?? planned.rule.threshold
            : planned.rule.threshold,
        direction: planned.direction,
        period: planned.rule.period,
      };
      hits.push(hit);

      if (opts.dryRun) continue;

      const outerId =
        (planned.direction === "up"
          ? planned.rule.toGroupOuterId || toGroup.id
          : toGroup.id) || toGroup.id;
      if (!outerId) {
        errors.push(`#${customer.innerId}: hiányzó cél csoport id`);
        continue;
      }

      await updateCustomerGroup(opts.config, customer.id, outerId);
      const ref = await upsertShopCustomer(opts.client, {
        shopId: opts.shopId,
        srCustomerInnerId: customer.innerId,
        srCustomerId: customer.id,
        email: customer.email,
        nameSnapshot: hit.name,
        srGroupInnerId: planned.toInner,
        srGroupNameSnapshot: toGroup.name,
        srStatus: "active",
      });

      if (planned.direction === "up") {
        await query(
          opts.client,
          `update shop_customers
           set group_rules_qualified_at = now(), updated_at = now()
           where id = $1`,
          [ref.id],
        ).catch(() => undefined);
      }

      const dirLabel =
        planned.direction === "up" ? "Feljebb" : "Lejjebb";
      const reason =
        planned.rule.metric === "order_count"
          ? `${hit.value} rendelés (küszöb ${hit.threshold})`
          : `${hit.value.toLocaleString("hu-HU")} Ft (küszöb ${hit.threshold.toLocaleString("hu-HU")} Ft)`;

      await recordGroupMove(opts.client, {
        shopId: opts.shopId,
        shopCustomerId: ref.id,
        srCustomerInnerId: customer.innerId,
        emailSnapshot: customer.email,
        fromGroupInnerId: customer.groupInnerId,
        fromGroupName: customer.groupName,
        toGroupInnerId: planned.toInner,
        toGroupName: toGroup.name,
        actorUserId: opts.actorUserId,
        orgId: opts.orgId,
        source: "rule",
        ruleId: planned.rule.id,
        reason: `${dirLabel}: ${planned.rule.name || "Automatizmus"}. ${reason}`,
        metric: planned.rule.metric,
        metricValue: planned.value,
        threshold: hit.threshold,
        period: planned.rule.period,
        direction: planned.direction,
      });
      applied += 1;
      await sleep(300);
    } catch (e) {
      errors.push(
        `#${customer.innerId}: ${e instanceof Error ? e.message : "kiértékelés hiba"}`,
      );
    }
  }

  return {
    scanned,
    hits,
    applied,
    skippedLocked,
    skippedCooldown,
    skippedGrace,
    errors,
    candidateSource,
  };
}
